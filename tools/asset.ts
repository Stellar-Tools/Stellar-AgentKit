import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getAssetDetails,
  getOrderbook,
  getTrades,
  type StellarAssetInput,
} from "../lib/asset";

const nativeAssetSchema = z.object({
  type: z.literal("native"),
});

const issuedAssetSchema = z.object({
  code: z.string().min(1).max(12),
  issuer: z.string().min(1),
});

const assetSchema = z.union([nativeAssetSchema, issuedAssetSchema]);

/**
 * Stellar Asset Explorer Tool
 *
 * A read-only tool that allows AI agents to query Stellar asset and market data:
 * - Asset details (trust count, circulating supply, issuer flags)
 * - SDEX orderbook (current bids and asks)
 * - Recent trade history for any trading pair
 *
 * This tool does NOT require a private key — all actions are read-only
 * Horizon API calls.
 */
export const StellarAssetTool = new DynamicStructuredTool({
  name: "stellar_asset_tool",
  description:
    "Query Stellar asset and market data: asset details (trust count, supply, issuer flags), " +
    "SDEX orderbook (current bids/asks for a trading pair), and recent trade history. " +
    "All actions are read-only.",
  schema: z.object({
    action: z
      .enum(["get_asset_details", "get_orderbook", "get_trades"])
      .describe(
        "The action to perform: " +
        "'get_asset_details' — lookup asset metadata; " +
        "'get_orderbook' — fetch current SDEX orderbook; " +
        "'get_trades' — fetch recent trades for a pair"
      ),
    // For get_asset_details
    assetCode: z
      .string()
      .min(1)
      .max(12)
      .optional()
      .describe("Asset code (e.g. 'USDC'). Required for 'get_asset_details'."),
    assetIssuer: z
      .string()
      .optional()
      .describe("Asset issuer public key. Required for 'get_asset_details'."),
    // For get_orderbook and get_trades
    baseAsset: assetSchema
      .optional()
      .describe("Base asset of the trading pair. Required for 'get_orderbook' and 'get_trades'."),
    counterAsset: assetSchema
      .optional()
      .describe("Counter asset of the trading pair. Required for 'get_orderbook' and 'get_trades'."),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Which Stellar network to query"),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .optional()
      .describe("Maximum number of records to return"),
    order: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order for trades: 'desc' (newest first) or 'asc' (oldest first)"),
  }),
  func: async (input: any) => {
    const network = input.network ?? "testnet";
    const config = { network };

    try {
      switch (input.action) {
        case "get_asset_details": {
          if (!input.assetCode || !input.assetIssuer) {
            throw new Error(
              "'assetCode' and 'assetIssuer' are required for 'get_asset_details'"
            );
          }
          const details = await getAssetDetails(
            input.assetCode,
            input.assetIssuer,
            config
          );
          return JSON.stringify(details, null, 2);
        }

        case "get_orderbook": {
          if (!input.baseAsset || !input.counterAsset) {
            throw new Error(
              "'baseAsset' and 'counterAsset' are required for 'get_orderbook'"
            );
          }
          const orderbook = await getOrderbook(
            input.baseAsset as StellarAssetInput,
            input.counterAsset as StellarAssetInput,
            config,
            input.limit ?? 10
          );
          return JSON.stringify(orderbook, null, 2);
        }

        case "get_trades": {
          if (!input.baseAsset || !input.counterAsset) {
            throw new Error(
              "'baseAsset' and 'counterAsset' are required for 'get_trades'"
            );
          }
          const trades = await getTrades(
            input.baseAsset as StellarAssetInput,
            input.counterAsset as StellarAssetInput,
            config,
            Math.min(input.limit ?? 10, 50),
            input.order ?? "desc"
          );
          if (trades.length === 0) {
            return "No trades found for this trading pair.";
          }
          return JSON.stringify(trades, null, 2);
        }

        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }
    } catch (error: any) {
      throw new Error(`Asset tool error (${input.action}): ${error.message}`);
    }
  },
});
