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
import {z} from "zod";
dotenv.config({ path: ".env" });

const fromAddress = process.env.STELLAR_PUBLIC_KEY as string;
const privateKey = process.env.STELLAR_PRIVATE_KEY as string;
// const toAddress = process.env.ETH_PUBLIC_KEY as string;
export const bridgeTokenTool = new DynamicStructuredTool({
  name: "bridge_token",
  description: "Bridge token from Stellar chain to EVM compatible chains. Requires amount and toAddress as string",
  schema: z.object({
    amount: z.string().describe("The amount of tokens to bridge"),
    toAddress: z.string().describe("The destination ETH address (as a string)"),
  }),
func: async ({amount,toAddress}) => {
  const sdk = new AllbridgeCoreSdk({ ...nodeRpcUrlsDefault, SRB: `${process.env.SRB_PROVIDER_URL}` });

  const chainDetailsMap = await sdk.chainDetailsMap();

  const sourceToken = ensure(chainDetailsMap[ChainSymbol.SRB].tokens.find((t) => t.symbol == "USDC"));
  const destinationToken = ensure(chainDetailsMap[ChainSymbol.ETH].tokens.find((t) => t.symbol == "USDC"));


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
  const xdrTx: string = (await sdk.bridge.rawTxBuilder.send(sendParams)) as string;

  // SendTx - Use unified transaction builder for XDR-based bridge operations
  const srbKeypair = Keypair.fromSecret(privateKey);
  const transaction = buildTransactionFromXDR("bridge", xdrTx, Networks.TESTNET);
  transaction.sign(srbKeypair);
  let signedTx = transaction.toXDR();

  const restoreXdrTx = await sdk.utils.srb.simulateAndCheckRestoreTxRequiredSoroban(signedTx, fromAddress);
  if (restoreXdrTx) {
    const restoreTx = TransactionBuilder.fromXDR(restoreXdrTx, Networks.TESTNET);
    restoreTx.sign(srbKeypair);
    const signedRestoreXdrTx = restoreTx.toXDR();
    const sentRestoreXdrTx = await sdk.utils.srb.sendTransactionSoroban(signedRestoreXdrTx);
    const confirmRestoreXdrTx = await sdk.utils.srb.confirmTx(sentRestoreXdrTx.hash);
    if (confirmRestoreXdrTx.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log(
        `Waited for Restore transaction to complete, but it did not. ` +
          `Check the transaction status manually. ` +
          `Hash: ${sentRestoreXdrTx.hash}`
      );
    } else if (confirmRestoreXdrTx.status === rpc.Api.GetTransactionStatus.FAILED) {
      console.log(`Transaction Restore failed. Check the transaction manually.` + `Hash: ${sentRestoreXdrTx.hash}`);
    } else {
      console.log(`Transaction Restore Confirmed. Hash: ${sentRestoreXdrTx.hash}`);
    }
    //get new tx with updated sequences
    const xdrTx2 = (await sdk.bridge.rawTxBuilder.send(sendParams)) as string;
    const transaction2 = buildTransactionFromXDR("bridge", xdrTx2, Networks.TESTNET);
    transaction2.sign(srbKeypair);
    signedTx = transaction2.toXDR();
  }

  const sent = await sdk.utils.srb.sendTransactionSoroban(signedTx);
  const confirm = await sdk.utils.srb.confirmTx(sent.hash);
  if (confirm.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    console.log(
      `Waited for transaction to complete, but it did not. ` +
        `Check the transaction status manually. ` +
        `Hash: ${sent.hash}`
    );
  } else if (confirm.status === rpc.Api.GetTransactionStatus.FAILED) {
    console.log(`Transaction failed. Check the transaction manually.` + `Hash: ${sent.hash}`);
  } else {
    console.log(`Transaction Confirmed. Hash: ${sent.hash}`);
  }

  //TrustLine check and Set up for destinationToken if it is SRB
  const destinationTokenSBR = sourceToken; // simulate destination is srb

  const balanceLine = await sdk.utils.srb.getBalanceLine(fromAddress, destinationTokenSBR.tokenAddress);
  console.log(`BalanceLine:`, balanceLine);
  const notEnoughBalanceLine = !balanceLine || Big(balanceLine.balance).add(amount).gt(Big(balanceLine.limit));
  if (notEnoughBalanceLine) {
    const xdrTx = await sdk.utils.srb.buildChangeTrustLineXdrTx({
      sender: fromAddress,
      tokenAddress: destinationTokenSBR.tokenAddress,
      // limit: "1000000",
    });

    //SignTx - Use unified transaction builder for XDR-based bridge TrustLine operation
    const keypair = StellarKeypair.fromSecret(privateKey);
    const transaction = buildTransactionFromXDR("bridge", xdrTx, Networks.TESTNET);
    transaction.sign(keypair);
    const signedTrustLineTx = transaction.toXDR();

    const submit = await sdk.utils.srb.submitTransactionStellar(signedTrustLineTx);
   return `Submitted change trust tx. Hash: ${submit.hash}`;
  }
}})

