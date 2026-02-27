import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description: "Query current balances for a Stellar account. Returns native XLM balance and all established trustlines (token balances). Use this to check if an account has sufficient funds before initiating a trade or bridge.",
  schema: z.object({
    address: z.string().describe("The Stellar address to check balances for"),
    network: z.enum(["testnet", "mainnet"]).default("testnet").describe("The network to use"),
  }),
  func: async ({ address, network }: { address: string; network: "testnet" | "mainnet" }) => {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
        throw new Error(`Invalid address format: ${address}`);
      }

      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const balances = account.balances.map((b: any) => {
        if (b.asset_type === "native") {
          return { asset: "XLM", balance: b.balance };
        } else {
          return {
            asset: `${b.asset_code}:${b.asset_issuer}`,
            balance: b.balance,
            code: b.asset_code,
            issuer: b.asset_issuer
          };
        }
      });

      return JSON.stringify({
        address,
        network,
        balances
      }, null, 2);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to get balance: ${msg}`;
    }
  },
});
