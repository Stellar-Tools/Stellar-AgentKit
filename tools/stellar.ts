import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "stellar-sdk";
// ... import StellarSdk, getPublicKey, connect, signTransaction, etc. as needed ...

/**
 * Send XLM payment
 * @param sender - Sender's public key (must match private key from env)
 * @param recipient - Recipient's public key
 * @param amount - Amount of XLM to send
 * @param network - Network to use (testnet or mainnet)
 * @returns Transaction hash
 */
export async function sendPayment(
  sender: string,
  recipient: string,
  amount: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<string> {
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

  // Validate that sender matches the private key
  if (sender !== sourcePublicKey) {
    throw new Error(
      `Sender mismatch: provided sender ${sender} does not match the public key ` +
      `derived from STELLAR_PRIVATE_KEY (${sourcePublicKey})`
    );
  }

  // Step 3: Create an unsigned transaction
  const horizonUrl = network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const account = await server.loadAccount(sourcePublicKey);

  const networkPassphrase = network === "mainnet"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;

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
  const tx = new StellarSdk.Transaction(signedTxXdr, networkPassphrase);
  const response = await server.submitTransaction(tx);

  return `Transaction successful! Hash: ${response.hash}`;
}

export const stellarSendPaymentTool = new DynamicStructuredTool({
  name: "stellar_send_payment",
  description: "Send a payment on the Stellar testnet. Requires recipient address and amount.",
  schema: z.object({
    recipient: z.string().describe("The Stellar address to send to"),
    amount: z.string().describe("The amount of XLM to send (as a string)"),
  }),
  func: async ({ recipient, amount }: { recipient: string; amount: string }) => {
    try {
      const publicKey = process.env.STELLAR_PUBLIC_KEY!;
      return await sendPayment(publicKey, recipient, amount);
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error occurred";
      return `Transaction failed: ${errorMessage}`;
    }
  },
});