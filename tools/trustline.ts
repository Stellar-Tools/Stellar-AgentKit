import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";
import { withRetry } from "../utils/retry";

export const stellarEnsureTrustlineTool = new DynamicStructuredTool({
  name: "stellar_ensure_trustline",
  description: "Verify and maintain asset trustlines for a Stellar account. Checks if a trustline for a specific asset exists and creates it if missing. ESSENTIAL to call this before many swap, bridge, or payment operations if you are unsure.",
  schema: z.object({
    assetCode: z.string().describe("The asset code (e.g., USDC)"),
    assetIssuer: z.string().describe("The asset issuer address"),
    network: z.enum(["testnet", "mainnet"]).default("testnet").describe("The network to use"),
  }),
  func: async ({ assetCode, assetIssuer, network }: { assetCode: string; assetIssuer: string; network: "testnet" | "mainnet" }) => {
    try {
      const privateKey = process.env.STELLAR_PRIVATE_KEY;
      if (!privateKey) throw new Error("STELLAR_PRIVATE_KEY not found in environment.");

      const keypair = StellarSdk.Keypair.fromSecret(privateKey);
      const publicKey = keypair.publicKey();

      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      const networkPassphrase = network === "mainnet" 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET;
      
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const asset = new StellarSdk.Asset(assetCode, assetIssuer);

      // 1. Check if trustline already exists
      const account = await withRetry(() => server.loadAccount(publicKey));
      const hasTrustline = account.balances.some((b: any) => 
        b.asset_code === assetCode && b.asset_issuer === assetIssuer
      );

      if (hasTrustline) {
        return `Trustline already exists for ${assetCode}:${assetIssuer}. No action needed.`;
      }

      // 2. Create trustline
      const fee = await withRetry(() => server.fetchBaseFee());
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: String(fee),
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset,
            limit: "922337203685.4775807",
          })
        )
        .setTimeout(100)
        .build();

      tx.sign(keypair);
      const result = await withRetry(() => server.submitTransaction(tx));

      return `Trustline successfully created for ${assetCode}:${assetIssuer}. Hash: ${result.hash}`;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to ensure trustline: ${msg}`;
    }
  },
});
