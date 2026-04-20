import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "stellar-sdk";
// ... import StellarSdk, getPublicKey, connect, signTransaction, etc. as needed ...

export const stellarSendPaymentTool = new DynamicStructuredTool({
  name: "stellar_send_payment",
  description: "Send a payment on the Stellar testnet. Requires recipient address and amount.",
  schema: z.object({
    recipient: z.string().describe("The Stellar address to send to"),
    amount: z.string().describe("The amount of XLM to send (as a string)"),
  }),
  func: async ({ recipient, amount }: { recipient: string; amount: string }) => {
    const isMainnet = process.env.STELLAR_NETWORK === "mainnet";
    const horizonUrl = isMainnet ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
    const networkPassphrase = isMainnet ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;


    try {
      // Step 1: Validate inputs
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
        throw new Error("Invalid recipient address.");
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Amount must be a positive number.");
      }

      // Step 2: Get private key from environment
      const privateKey = process.env.STELLAR_PRIVATE_KEY as string;
      if (!privateKey || !StellarSdk.StrKey.isValidEd25519SecretSeed(privateKey)) {
        throw new Error("Invalid or missing Stellar private key in environment.");
      }
      const keypair = StellarSdk.Keypair.fromSecret(privateKey);
      const sourcePublicKey = keypair.publicKey();

      // Step 3: Create an unsigned transaction
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(sourcePublicKey);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipient,
            asset: StellarSdk.Asset.native(),
            amount: amount,
          })
        )
        .setTimeout(300)
        .build();

      // Step 4: Sign the transaction with the private key
      transaction.sign(keypair);
      const signedTxXdr = transaction.toXDR();

      // Step 5: Submit the transaction
      const response = await server.submitTransaction(transaction);

      return `Transaction successful! Hash: ${response.hash}`;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.title ||
        error.message ||
        "Unknown error occurred";
      return `Transaction failed: ${errorMessage}`;
    }
  },
});