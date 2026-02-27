import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Horizon } from "@stellar/stellar-sdk";

export interface AssetBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface BalanceResult {
  publicKey: string;
  balances: AssetBalance[];
  network: string;
}

/**
 * Get account balances for a Stellar address
 * @param publicKey The Stellar public key (G... address)
 * @param network The network to query: "testnet" or "mainnet"
 * @returns Account balances including native XLM and custom assets
 */
export async function getAccountBalances(
  publicKey: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<BalanceResult> {
  const horizonUrl =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  const server = new Horizon.Server(horizonUrl);

  try {
    const account = await server.loadAccount(publicKey);

    return {
      publicKey,
      balances: account.balances as AssetBalance[],
      network,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to fetch balances for ${publicKey} on ${network}: ${error.message}`
    );
  }
}

export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description:
    "Get account balances for a Stellar address including native XLM and all custom assets (tokens). Returns all balances with asset details.",
  schema: z.object({
    publicKey: z
      .string()
      .optional()
      .describe(
        "Stellar public key (G... address). If not provided, uses STELLAR_PUBLIC_KEY from env."
      ),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Network to query: testnet or mainnet"),
  }),
  func: async ({
    publicKey,
    network,
  }: {
    publicKey?: string;
    network: "testnet" | "mainnet";
  }) => {
    try {
      const targetKey = publicKey || process.env.STELLAR_PUBLIC_KEY;
      if (!targetKey) {
        return "Error: No public key provided and STELLAR_PUBLIC_KEY environment variable is not set.";
      }
      const result = await getAccountBalances(targetKey, network);

      // Format output
      const formattedBalances = result.balances.map((b) => {
        if (b.asset_type === "native") {
          return `XLM: ${b.balance}`;
        } else if (b.asset_type === "liquidity_pool_shares") {
          // Liquidity pool shares don't have asset_code/asset_issuer
          return `Liquidity Pool Shares: ${b.balance}`;
        } else {
          return `${b.asset_code} (${b.asset_issuer?.substring(0, 8)}...): ${b.balance}`;
        }
      });

      return `Account: ${targetKey}\nNetwork: ${network}\nBalances:\n${formattedBalances.join("\n")}`;
    } catch (error: any) {
      console.error("stellarGetBalanceTool error:", error.message);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  },
});
