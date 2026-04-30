import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";
// ... import StellarSdk, getPublicKey, connect, signTransaction, etc. as needed ...

export const stellarSendPaymentTool = new DynamicStructuredTool({
  name: "stellar_send_payment",
  description: "Send a payment on the Stellar testnet. Requires recipient address and amount.",
  schema: z.object({
    recipient: z.string().describe("The Stellar address to send to"),
    amount: z.string().describe("The amount of XLM to send (as a string)"),
  }),
  func: async ({ recipient, amount }: { recipient: string; amount: string }) => {
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
      const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await server.loadAccount(sourcePublicKey);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
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
      const tx = new StellarSdk.Transaction(signedTxXdr, StellarSdk.Networks.TESTNET);
      const response = await server.submitTransaction(tx);

      return `Transaction successful! Hash: ${response.hash}`;
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

export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description: "Get the balance of a Stellar account. Returns balances for XLM and all other assets.",
  schema: z.object({
    publicKey: z.string().describe("The Stellar public key to check the balance for"),
    network: z.enum(["testnet", "mainnet"]).optional().describe("The Stellar network to use (defaults to testnet)"),
  }),
  func: async ({ publicKey, network = "testnet" }: { publicKey: string; network?: string }) => {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new Error("Invalid Stellar public key.");
      }

      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(publicKey);

      const balances = account.balances.map((balance: any) => {
        if (balance.asset_type === "native") {
          return {
            asset: "XLM",
            balance: balance.balance,
          };
        } else {
          return {
            asset: `${balance.asset_code}:${balance.asset_issuer}`,
            balance: balance.balance,
          };
        }
      });

      return JSON.stringify(balances, null, 2);
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error occurred";
      return `Failed to fetch balance: ${errorMessage}`;
    }
  },
});

export const stellarGetAccountInfoTool = new DynamicStructuredTool({
  name: "stellar_get_account_info",
  description: "Get full details of a Stellar account, including sequence number, signers, and thresholds.",
  schema: z.object({
    publicKey: z.string().describe("The Stellar public key to get info for"),
    network: z.enum(["testnet", "mainnet"]).optional().describe("The Stellar network to use (defaults to testnet)"),
  }),
  func: async ({ publicKey, network = "testnet" }: { publicKey: string; network?: string }) => {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new Error("Invalid Stellar public key.");
      }

      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(publicKey);

      return JSON.stringify(account, (key, value) => (key === "_links" || key === "balances" ? undefined : value), 2);
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error occurred";
      return `Failed to fetch account info: ${errorMessage}`;
    }
  },
});