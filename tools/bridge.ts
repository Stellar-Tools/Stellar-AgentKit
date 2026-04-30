import Big from "big.js";
import {
  AllbridgeCoreSdk,
  AmountFormat,
  ChainSymbol,
  FeePaymentMethod,
  Messenger,
  nodeRpcUrlsDefault
} from "@allbridge/bridge-core-sdk";
import {
  Keypair,
  Keypair as StellarKeypair,
  rpc,
  Networks
} from "@stellar/stellar-sdk";
import { ensure } from "../utils/utils";
import { buildTransactionFromXDR } from "../utils/buildTransaction";
import * as dotenv from "dotenv";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config({ path: ".env" });

const fromAddress = process.env.STELLAR_PUBLIC_KEY as string;
const privateKey = process.env.STELLAR_PRIVATE_KEY as string;

type StellarNetwork = "stellar-testnet" | "stellar-mainnet";

/**
 * Supported target EVM chains for bridging from Stellar.
 * Maps user-facing chain names to Allbridge ChainSymbol values.
 */
export type TargetChain = "ethereum" | "polygon" | "arbitrum" | "base";

const TARGET_CHAIN_MAP: Record<TargetChain, ChainSymbol> = {
  ethereum: ChainSymbol.ETH,
  polygon: ChainSymbol.POL,
  arbitrum: ChainSymbol.ARB,
  base: ChainSymbol.BAS,
};

const STELLAR_NETWORK_CONFIG: Record<StellarNetwork, { networkPassphrase: string }> = {
  "stellar-testnet": {
    networkPassphrase: Networks.TESTNET,
  },
  "stellar-mainnet": {
    networkPassphrase: Networks.PUBLIC,
  },
};

export const bridgeTokenTool = new DynamicStructuredTool({
  name: "bridge_token",
  description:
    "Bridge USDC from Stellar to an EVM-compatible chain (Ethereum, Polygon, Arbitrum, or Base). " +
    "Requires amount, toAddress, and optionally targetChain (defaults to ethereum).",

  schema: z.object({
    amount: z.string().describe("The amount of tokens to bridge"),
    toAddress: z.string().describe("The destination EVM address"),
    fromNetwork: z
      .enum(["stellar-testnet", "stellar-mainnet"])
      .default("stellar-testnet")
      .describe("Source Stellar network"),
    targetChain: z
      .enum(["ethereum", "polygon", "arbitrum", "base"])
      .default("ethereum")
      .describe("Destination EVM chain: ethereum | polygon | arbitrum | base"),
  }),

  func: async ({
    amount,
    toAddress,
    fromNetwork,
    targetChain,
  }: {
    amount: string;
    toAddress: string;
    fromNetwork: StellarNetwork;
    targetChain: TargetChain;
  }) => {
    // Mainnet safeguard - additional layer beyond AgentClient
    if (
      fromNetwork === "stellar-mainnet" &&
      process.env.ALLOW_MAINNET_BRIDGE !== "true"
    ) {
      throw new Error(
        "Mainnet bridging is disabled. Set ALLOW_MAINNET_BRIDGE=true in your .env file to enable."
      );
    }

    const destinationChainSymbol = TARGET_CHAIN_MAP[targetChain];

    const sdk = new AllbridgeCoreSdk({
      ...nodeRpcUrlsDefault,
      SRB: `${process.env.SRB_PROVIDER_URL}`,
    });

    const chainDetailsMap = await sdk.chainDetailsMap();

    const sourceToken = ensure(
      chainDetailsMap[ChainSymbol.SRB].tokens.find(
        (t) => t.symbol === "USDC"
      )
    );

    const destinationChainDetails = chainDetailsMap[destinationChainSymbol];
    if (!destinationChainDetails) {
      throw new Error(`Chain not supported by Allbridge: ${targetChain}`);
    }
    const destinationToken = ensure(
      destinationChainDetails.tokens.find((t) => t.symbol === "USDC")
    );

    const sendParams = {
      amount,
      fromAccountAddress: fromAddress,
      toAccountAddress: toAddress,
      sourceToken,
      destinationToken,
      messenger: Messenger.ALLBRIDGE,
      extraGas: "1.15",
      extraGasFormat: AmountFormat.FLOAT,
      gasFeePaymentMethod: FeePaymentMethod.WITH_STABLECOIN,
    };

    const xdrTx = (await sdk.bridge.rawTxBuilder.send(sendParams)) as string;

    const srbKeypair = Keypair.fromSecret(privateKey);
    const transaction = buildTransactionFromXDR(
      "bridge",
      xdrTx,
      STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase
    );
    transaction.sign(srbKeypair);
    let signedTx = transaction.toXDR();

    const restoreXdrTx =
      await sdk.utils.srb.simulateAndCheckRestoreTxRequiredSoroban(
        signedTx,
        fromAddress
      );

    if (restoreXdrTx) {
      const restoreTx = buildTransactionFromXDR(
        "bridge",
        restoreXdrTx,
        STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase
      );
      restoreTx.sign(srbKeypair);
      const signedRestoreXdrTx = restoreTx.toXDR();

      const sentRestoreXdrTx =
        await sdk.utils.srb.sendTransactionSoroban(signedRestoreXdrTx);

      const confirmRestoreXdrTx = await sdk.utils.srb.confirmTx(
        sentRestoreXdrTx.hash
      );

      if (confirmRestoreXdrTx.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(
          `Restore transaction failed. Hash: ${sentRestoreXdrTx.hash}`
        );
      }

      if (
        confirmRestoreXdrTx.status === rpc.Api.GetTransactionStatus.NOT_FOUND
      ) {
        return {
          status: "pending_restore",
          hash: sentRestoreXdrTx.hash,
          network: fromNetwork,
          targetChain,
        };
      }

      // Rebuild tx with updated sequence numbers after restore
      const xdrTx2 = (await sdk.bridge.rawTxBuilder.send(sendParams)) as string;
      const transaction2 = buildTransactionFromXDR(
        "bridge",
        xdrTx2,
        STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase
      );
      transaction2.sign(srbKeypair);
      signedTx = transaction2.toXDR();
    }

    const sent = await sdk.utils.srb.sendTransactionSoroban(signedTx);
    const confirm = await sdk.utils.srb.confirmTx(sent.hash);

    if (confirm.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return {
        status: "pending",
        hash: sent.hash,
        network: fromNetwork,
        targetChain,
      };
    }

    if (confirm.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed. Hash: ${sent.hash}`);
    }

    // TrustLine check and setup for source token on Stellar side
    const destinationTokenSBR = sourceToken;

    const balanceLine = await sdk.utils.srb.getBalanceLine(
      fromAddress,
      destinationTokenSBR.tokenAddress
    );

    const notEnoughBalanceLine =
      !balanceLine ||
      Big(balanceLine.balance).add(amount).gt(Big(balanceLine.limit));

    if (notEnoughBalanceLine) {
      const xdrTx = await sdk.utils.srb.buildChangeTrustLineXdrTx({
        sender: fromAddress,
        tokenAddress: destinationTokenSBR.tokenAddress,
      });

      const keypair = StellarKeypair.fromSecret(privateKey);
      const trustTx = buildTransactionFromXDR(
        "bridge",
        xdrTx,
        STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase
      );
      trustTx.sign(keypair);
      const signedTrustLineTx = trustTx.toXDR();

      const submit = await sdk.utils.srb.submitTransactionStellar(
        signedTrustLineTx
      );

      return {
        status: "trustline_submitted",
        hash: submit.hash,
        network: fromNetwork,
        targetChain,
      };
    }

    return {
      status: "confirmed",
      hash: sent.hash,
      network: fromNetwork,
      targetChain,
      asset: sourceToken.symbol,
      amount,
    };
  },
});
