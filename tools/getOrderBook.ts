import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Tool: getOrderBook
 *
 * Queries the Stellar DEX order book (via Horizon) for a given asset pair.
 * Returns the top N bids and asks with their prices and amounts, plus
 * a derived mid-price and spread. This is essential context before executing
 * a swap so the agent can reason about slippage and price impact.
 *
 * Supports both native XLM and issued assets (e.g., USDC, yXLM).
 */
const getOrderBookTool = new DynamicStructuredTool({
  name: "get_order_book",
  description:
    "Query the Stellar DEX order book for a trading pair. Returns top bids and asks " +
    "with prices and amounts, mid-price, spread, and liquidity depth. Use this before " +
    "executing swaps to assess slippage and current market conditions. " +
    "Supports native XLM and any issued Stellar asset.",
  schema: z.object({
    sellingAssetCode: z
      .string()
      .describe(
        'Asset code being sold. Use "XLM" for native lumens, or e.g. "USDC".'
      ),
    sellingAssetIssuer: z
      .string()
      .optional()
      .describe(
        "Issuer G-address of the selling asset. Omit for native XLM."
      ),
    buyingAssetCode: z
      .string()
      .describe(
        'Asset code being bought. Use "XLM" for native lumens, or e.g. "USDC".'
      ),
    buyingAssetIssuer: z
      .string()
      .optional()
      .describe("Issuer G-address of the buying asset. Omit for native XLM."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of order book levels to return per side (1-20). Default 5."),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("The Stellar network to query. Defaults to testnet."),
  }),
  func: async ({
    sellingAssetCode,
    sellingAssetIssuer,
    buyingAssetCode,
    buyingAssetIssuer,
    limit,
    network,
  }: {
    sellingAssetCode: string;
    sellingAssetIssuer?: string;
    buyingAssetCode: string;
    buyingAssetIssuer?: string;
    limit: number;
    network: "testnet" | "mainnet";
  }) => {
    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const server = new StellarSdk.Horizon.Server(horizonUrl);

    // Resolve assets
    let sellingAsset: StellarSdk.Asset;
    let buyingAsset: StellarSdk.Asset;

    try {
      sellingAsset =
        sellingAssetCode.toUpperCase() === "XLM" && !sellingAssetIssuer
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(sellingAssetCode, sellingAssetIssuer!);
    } catch {
      return JSON.stringify({
        success: false,
        error: `Invalid selling asset: code="${sellingAssetCode}", issuer="${sellingAssetIssuer}". ` +
          "Asset codes must be 1-12 alphanumeric characters and issuer must be a valid G-address.",
      });
    }

    try {
      buyingAsset =
        buyingAssetCode.toUpperCase() === "XLM" && !buyingAssetIssuer
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(buyingAssetCode, buyingAssetIssuer!);
    } catch {
      return JSON.stringify({
        success: false,
        error: `Invalid buying asset: code="${buyingAssetCode}", issuer="${buyingAssetIssuer}".`,
      });
    }

    try {
      const orderBook = await server
        .orderbook(sellingAsset, buyingAsset)
        .limit(limit)
        .call();

      // Derive mid-price and spread if both sides have liquidity
      let midPrice: string | null = null;
      let spread: string | null = null;
      let spreadBps: string | null = null;

      if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        const bestBid = parseFloat(orderBook.bids[0].price);
        const bestAsk = parseFloat(orderBook.asks[0].price);
        const mid = (bestBid + bestAsk) / 2;
        const spreadAbs = bestAsk - bestBid;
        midPrice = mid.toFixed(7);
        spread = spreadAbs.toFixed(7);
        spreadBps = ((spreadAbs / mid) * 10000).toFixed(2);
      }

      // Compute total liquidity depth for each side
      const bidDepth = orderBook.bids.reduce(
        (acc, b) => acc + parseFloat(b.amount),
        0
      );
      const askDepth = orderBook.asks.reduce(
        (acc, a) => acc + parseFloat(a.amount),
        0
      );

      const result = {
        success: true,
        network,
        pair: {
          selling: sellingAsset.isNative()
            ? "XLM (native)"
            : `${sellingAsset.getCode()}:${sellingAsset.getIssuer()}`,
          buying: buyingAsset.isNative()
            ? "XLM (native)"
            : `${buyingAsset.getCode()}:${buyingAsset.getIssuer()}`,
        },
        marketSummary: {
          midPrice,
          spread,
          spreadBps: spreadBps ? `${spreadBps} bps` : null,
          bidSideLiquidity: bidDepth.toFixed(7),
          askSideLiquidity: askDepth.toFixed(7),
        },
        bids: orderBook.bids.map((b) => ({
          price: b.price,
          amount: b.amount,
        })),
        asks: orderBook.asks.map((a) => ({
          price: a.price,
          amount: a.amount,
        })),
      };

      return JSON.stringify(result, null, 2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        success: false,
        error: `Failed to fetch order book: ${message}`,
      });
    }
  },
});

export default getOrderBookTool;
