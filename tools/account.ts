import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "stellar-sdk";

const getServer = (network: "testnet" | "mainnet") =>
  new StellarSdk.Horizon.Server(
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org"
  );

/**
 * stellar_get_balance — Get XLM and token balances for any Stellar account.
 */
export const stellarGetBalanceTool = new DynamicStructuredTool({
  name: "stellar_get_balance",
  description:
    "Get the XLM and all token balances for a Stellar account. Returns native XLM balance and any issued tokens.",
  schema: z.object({
    publicKey: z
      .string()
      .describe("The Stellar public key (G...) to query balances for"),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("The Stellar network to query (testnet or mainnet)"),
  }),
  func: async ({
    publicKey,
    network = "testnet",
  }: {
    publicKey: string;
    network?: "testnet" | "mainnet";
  }) => {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new Error(`Invalid Stellar public key: ${publicKey}`);
      }

      const server = getServer(network);
      const account = await server.loadAccount(publicKey);

      const balances = account.balances.map((b) => {
        if (b.asset_type === "native") {
          return { asset: "XLM", balance: b.balance };
        }
        if (b.asset_type === "liquidity_pool_shares") {
          const lpBalance = b as StellarSdk.Horizon.HorizonApi.BalanceLineLiquidityPool;
          return {
            asset: `liquidity_pool:${lpBalance.liquidity_pool_id}`,
            balance: lpBalance.balance,
          };
        }
        const assetBalance = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
        return {
          asset: `${assetBalance.asset_code}:${assetBalance.asset_issuer}`,
          balance: assetBalance.balance,
        };
      });

      const result = {
        publicKey,
        network,
        balances,
        totalAssets: balances.length,
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error";
      return `Failed to fetch balance for ${publicKey} on ${network}: ${msg}`;
    }
  },
});

/**
 * stellar_get_account_info — Get full account details for a Stellar account.
 */
export const stellarGetAccountInfoTool = new DynamicStructuredTool({
  name: "stellar_get_account_info",
  description:
    "Get full account information for a Stellar address, including sequence number, thresholds, flags, signers, and data entries.",
  schema: z.object({
    publicKey: z
      .string()
      .describe("The Stellar public key (G...) to look up"),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("The Stellar network to query"),
  }),
  func: async ({
    publicKey,
    network = "testnet",
  }: {
    publicKey: string;
    network?: "testnet" | "mainnet";
  }) => {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new Error(`Invalid Stellar public key: ${publicKey}`);
      }

      const server = getServer(network);
      const account = await server.loadAccount(publicKey);

      const info = {
        publicKey: account.id,
        network,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentry_count,
        thresholds: account.thresholds,
        flags: account.flags,
        signers: account.signers.map((s) => ({
          key: s.key,
          weight: s.weight,
          type: s.type,
        })),
        balanceCount: account.balances.length,
        dataEntryCount: Object.keys(account.data_attr).length,
        dataEntries: account.data_attr,
      };

      return JSON.stringify(info, null, 2);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error";
      return `Failed to fetch account info for ${publicKey} on ${network}: ${msg}`;
    }
  },
});
