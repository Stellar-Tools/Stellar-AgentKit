import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Horizon, StrKey } from "@stellar/stellar-sdk";

export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description: "Get the balance of a Stellar account for XLM or a specific asset.",
  schema: z.object({
    address: z.string().describe("The Stellar public key (G...) to check balance for"),
    assetCode: z.string().optional().describe("The asset code (e.g., 'USDC', 'XLM'). Defaults to 'XLM'."),
    assetIssuer: z.string().optional().describe("The asset issuer address. Required for non-XLM assets to avoid ambiguity."),
    rpcUrl: z.string().optional().describe("Optional Horizon RPC URL to use."),
    network: z.string().optional().describe("Optional network name ('mainnet' or 'testnet')."),
  }),
  func: async ({ 
    address, 
    assetCode = "XLM", 
    assetIssuer, 
    rpcUrl, 
    network 
  }: { 
    address: string; 
    assetCode?: string; 
    assetIssuer?: string;
    rpcUrl?: string;
    network?: string;
  }) => {
    try {
      if (!StrKey.isValidEd25519PublicKey(address)) {
        throw new Error("Invalid Stellar address.");
      }

      const envNetwork = typeof process !== 'undefined' ? process.env.STELLAR_NETWORK || "testnet" : "testnet";
      const actualNetwork = (network || envNetwork).toLowerCase();
      
      let horizonUrl = rpcUrl;
      if (!horizonUrl) {
        horizonUrl = actualNetwork.includes("mainnet")
          ? "https://horizon.stellar.org" 
          : "https://horizon-testnet.stellar.org";
      }
      
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const balances = account.balances;
      
      if (assetCode.toUpperCase() === "XLM") {
        const nativeBalance = balances.find((b: any) => b.asset_type === "native");
        return nativeBalance ? `Balance: ${nativeBalance.balance} XLM` : "Balance: 0 XLM";
      }

      // For non-XLM assets, we should ideally have an issuer to avoid ambiguity.
      // If not provided, we check if there's exactly one asset with that code.
      const assetBalance = balances.find((b: any) => {
        if (b.asset_type === "native" || b.asset_type === "liquidity_pool_shares") return false;
        return b.asset_code === assetCode && (!assetIssuer || b.asset_issuer === assetIssuer);
      });

      if (!assetBalance) {
        return `Balance: 0 ${assetCode}${assetIssuer ? ` (${assetIssuer})` : ""}`;
      }

      // Check for ambiguity if assetIssuer was omitted
      if (!assetIssuer) {
        const matches = balances.filter((b: any) => {
          if (b.asset_type === "native" || b.asset_type === "liquidity_pool_shares") return false;
          return b.asset_code === assetCode;
        });

        if (matches.length > 1) {
          return `Ambiguity detected: Multiple assets found with code '${assetCode}'. Please specify the 'assetIssuer' to get the correct balance. Found issuers: ${matches.map((m: any) => m.asset_issuer).join(", ")}`;
        }
      }

      const line = assetBalance as any;
      return `Balance: ${line.balance} ${line.asset_code} (${line.asset_issuer})`;
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
    rpcUrl: z.string().optional().describe("Optional Horizon RPC URL to use."),
    network: z.string().optional().describe("Optional network name ('mainnet' or 'testnet')."),
  }),
  func: async ({ address, rpcUrl, network }: { address: string; rpcUrl?: string; network?: string }) => {
    try {
      if (!StrKey.isValidEd25519PublicKey(address)) {
        throw new Error("Invalid Stellar address.");
      }

      const envNetwork = typeof process !== 'undefined' ? process.env.STELLAR_NETWORK || "testnet" : "testnet";
      const actualNetwork = (network || envNetwork).toLowerCase();
      
      let horizonUrl = rpcUrl;
      if (!horizonUrl) {
        horizonUrl = actualNetwork.includes("mainnet")
          ? "https://horizon.stellar.org" 
          : "https://horizon-testnet.stellar.org";
      }
      
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const balances = account.balances.map((b: any) => {
        if (b.asset_type === "native") {
          return `XLM: ${b.balance}`;
        }
        if (b.asset_type === "liquidity_pool_shares") {
          return `LP Share (${b.liquidity_pool_id}): ${b.balance}`;
        }
        return `${b.asset_code} (${b.asset_issuer}): ${b.balance}`;
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

