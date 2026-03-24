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
  TransactionBuilder as StellarTransactionBuilder,
  TransactionBuilder,
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
    "Bridge token from Stellar chain to EVM compatible chains. Requires amount and toAddress as string",

  schema: z.object({
    amount: z.string().describe("The amount of tokens to bridge"),
    toAddress: z.string().describe("The destination address"),
    fromNetwork: z
      .enum(["stellar-testnet", "stellar-mainnet"])
      .default("stellar-testnet")
      .describe("Source Stellar network"),
  }),

  func: async ({
    amount,
    toAddress,
    fromNetwork,
  }: {
    amount: string;
    toAddress: string;
    fromNetwork: StellarNetwork;
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
    const destinationToken = ensure(
      chainDetailsMap[ChainSymbol.ETH].tokens.find(
        (t) => t.symbol === "USDC"
      )
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

    const xdrTx = (await sdk.bridge.rawTxBuilder.send(
      sendParams
    )) as string;

    // Use unified transaction builder for XDR-based bridge operations
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

      // Handle FAILED restore explicitly
      if (
        confirmRestoreXdrTx.status === rpc.Api.GetTransactionStatus.FAILED
      ) {
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
        };
      }

      // Get new tx with updated sequences
      const xdrTx2 = (await sdk.bridge.rawTxBuilder.send(
        sendParams
      )) as string;

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
      };
    }

    if (confirm.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed. Hash: ${sent.hash}`);
    }

    // TrustLine check and setup for destinationToken if it is SRB
    const destinationTokenSBR = sourceToken;

    const balanceLine = await sdk.utils.srb.getBalanceLine(
      fromAddress,
      destinationTokenSBR.tokenAddress
    );

    const notEnoughBalanceLine =
      !balanceLine ||
      Big(balanceLine.balance)
        .add(amount)
        .gt(Big(balanceLine.limit));

    if (notEnoughBalanceLine) {
      const xdrTx =
        await sdk.utils.srb.buildChangeTrustLineXdrTx({
          sender: fromAddress,
          tokenAddress: destinationTokenSBR.tokenAddress,
        });

      // Use unified transaction builder for XDR-based bridge TrustLine operation
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
      };
    }

    return {
      status: "confirmed",
      hash: sent.hash,
      network: fromNetwork,
      asset: sourceToken.symbol,
      amount,
    };
  },
});