import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Horizon, StrKey } from "@stellar/stellar-sdk";

export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description: "Get the balance of a Stellar account for XLM or a specific asset.",
  schema: z.object({
    address: z.string().describe("The Stellar public key (G...) to check balance for"),
    assetCode: z.string().optional().describe("The asset code (e.g., 'USDC', 'XLM'). Defaults to 'XLM'."),
    assetIssuer: z.string().optional().describe("The asset issuer address. Required for non-XLM assets (except if it is a well-known asset code, but recommended to provide)."),
  }),
  func: async ({ address, assetCode = "XLM", assetIssuer }: { address: string; assetCode?: string; assetIssuer?: string }) => {
    try {
      if (!StrKey.isValidEd25519PublicKey(address)) {
        throw new Error("Invalid Stellar address.");
      }

      const network = typeof process !== 'undefined' ? process.env.STELLAR_NETWORK || "testnet" : "testnet";
      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const balances = account.balances;
      
      if (assetCode.toUpperCase() === "XLM") {
        const nativeBalance = balances.find((b: Horizon.BalanceLine) => b.asset_type === "native");
        return nativeBalance ? `Balance: ${nativeBalance.balance} XLM` : "Balance: 0 XLM";
      }

      const assetBalance = balances.find((b: Horizon.BalanceLine) => {
        if (b.asset_type === "native") return false;
        return b.asset_code === assetCode && (!assetIssuer || b.asset_issuer === assetIssuer);
      });

      if (!assetBalance) {
        return `Balance: 0 ${assetCode}${assetIssuer ? ` (${assetIssuer})` : ""}`;
      }

      return `Balance: ${assetBalance.balance} ${assetCode}${assetIssuer ? ` (${assetIssuer})` : ""}`;
    } catch (error: any) {
      return `Failed to fetch balance: ${error.message}`;
    }
  },
});

export const stellarGetAllBalancesTool = new DynamicStructuredTool({
  name: "stellar_get_all_balances",
  description: "Get all asset balances for a Stellar account.",
  schema: z.object({
    address: z.string().describe("The Stellar public key (G...) to check balances for"),
  }),
  func: async ({ address }: { address: string }) => {
    try {
      if (!StrKey.isValidEd25519PublicKey(address)) {
        throw new Error("Invalid Stellar address.");
      }

      const network = typeof process !== 'undefined' ? process.env.STELLAR_NETWORK || "testnet" : "testnet";
      const horizonUrl = network === "mainnet" 
        ? "https://horizon.stellar.org" 
        : "https://horizon-testnet.stellar.org";
      
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const balances = account.balances.map((b: Horizon.BalanceLine) => {
        if (b.asset_type === "native") {
          return `XLM: ${b.balance}`;
        }
        return `${(b as Horizon.BalanceLineAsset).asset_code} (${(b as Horizon.BalanceLineAsset).asset_issuer}): ${b.balance}`;
      });

      if (balances.length === 0) {
        return "No balances found for this account.";
      }

      return `Balances for ${address}:\n${balances.join("\n")}`;
    } catch (error: any) {
      return `Failed to fetch balances: ${error.message}`;
    }
  },
});

