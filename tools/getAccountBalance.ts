import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

export interface AccountBalance {
  asset: string;
  balance: string;
  assetType: string;
  limit?: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
}

export interface AccountBalanceResult {
  accountId: string;
  network: string;
  balances: AccountBalance[];
  totalBalances: number;
  isValid: boolean;
  error?: string;
}

const getAccountBalanceSchema = z.object({
  accountId: z
    .string()
    .min(56)
    .max(56)
    .describe(
      "The Stellar account public key (G-address, 56 characters) to query balances for."
    ),
  network: z
    .enum(["testnet", "mainnet"])
    .default("mainnet")
    .describe("The Stellar network to query. Defaults to mainnet."),
  includeZeroBalances: z
    .boolean()
    .default(false)
    .describe(
      "Whether to include assets with a zero balance in the response."
    ),
});

async function fetchAccountBalances(
  accountId: string,
  network: "testnet" | "mainnet",
  includeZeroBalances: boolean
): Promise<AccountBalanceResult> {
  const horizonUrl =
    network === "testnet"
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org";

  const server = new StellarSdk.Horizon.Server(horizonUrl);

  try {
    const account = await server.loadAccount(accountId);

    const balances: AccountBalance[] = account.balances
      .map((b: StellarSdk.Horizon.HorizonApi.BalanceLine) => {
        let assetLabel: string;

        if (b.asset_type === "native") {
          assetLabel = "XLM";
        } else if (
          b.asset_type === "credit_alphanum4" ||
          b.asset_type === "credit_alphanum12"
        ) {
          const typed = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
          assetLabel = `${typed.asset_code}:${typed.asset_issuer.slice(0, 8)}...`;
        } else {
          assetLabel = b.asset_type;
        }

        const entry: AccountBalance = {
          asset: assetLabel,
          balance: b.balance,
          assetType: b.asset_type,
        };

        // Include trustline limits for non-native assets
        if (b.asset_type !== "native") {
          const typed = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
          entry.limit = typed.limit;
          entry.buyingLiabilities = typed.buying_liabilities;
          entry.sellingLiabilities = typed.selling_liabilities;
        }

        return entry;
      })
      .filter(
        (b: AccountBalance) =>
          includeZeroBalances || parseFloat(b.balance) > 0 || b.asset === "XLM"
      );

    return {
      accountId,
      network,
      balances,
      totalBalances: balances.length,
      isValid: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound =
      message.includes("404") || message.includes("not found");

    return {
      accountId,
      network,
      balances: [],
      totalBalances: 0,
      isValid: false,
      error: isNotFound
        ? `Account ${accountId} does not exist on ${network}.`
        : `Failed to load account: ${message}`,
    };
  }
}

export function createGetAccountBalanceTool(): DynamicStructuredTool {
  return new DynamicStructuredTool<any>({
    name: "get_account_balance",
    description: `
      Fetches the full balance sheet of a Stellar account by its public key.
      Returns the native XLM balance plus all asset trustlines (issued tokens).
      Use this before executing swaps, payments, or any DeFi operations to verify
      the account has sufficient funds. Also useful for portfolio overviews.
    `.trim(),
    schema: getAccountBalanceSchema,
    func: async ({ accountId, network, includeZeroBalances }) => {
      const result = await fetchAccountBalances(
        accountId,
        network ?? "mainnet",
        includeZeroBalances ?? false
      );

      if (!result.isValid) {
        return JSON.stringify({ success: false, error: result.error });
      }

      return JSON.stringify({
        success: true,
        accountId: result.accountId,
        network: result.network,
        totalAssets: result.totalBalances,
        balances: result.balances,
      });
    },
  });
}