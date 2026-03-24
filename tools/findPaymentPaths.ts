import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Tool: findPaymentPaths
 *
 * Uses Horizon's path-finding endpoint to discover available DEX routes
 * for converting one asset to another, including multi-hop paths through
 * intermediate assets. Returns ranked paths with expected output amounts
 * and the intermediate asset hops involved.
 *
 * This is a read-only preflight tool — it does NOT submit a transaction.
 * Use the results to inform the agent which path to use for path-payment
 * operations, and to reason about expected slippage.
 *
 * Supports both strict-send (fix source amount) and strict-receive
 * (fix destination amount) path finding.
 */
const findPaymentPathsTool = new DynamicStructuredTool({
  name: "find_payment_paths",
  description:
    "Find optimal DEX payment paths between two assets on Stellar. " +
    "Returns available conversion routes (including multi-hop paths), " +
    "expected output amounts, and intermediate asset hops. " +
    "Use this before path-payment operations to select the best route and " +
    "estimate how much the recipient will receive (or how much you need to send). " +
    "Supports both strict-send (you fix the input amount) and strict-receive " +
    "(you fix the output amount) modes.",
  schema: z.object({
    mode: z
      .enum(["strict_send", "strict_receive"])
      .describe(
        "strict_send: fix the source amount, find max destination amount. " +
          "strict_receive: fix the destination amount, find min source amount."
      ),
    sourceAssetCode: z
      .string()
      .describe('Source asset code, e.g. "XLM" or "USDC".'),
    sourceAssetIssuer: z
      .string()
      .optional()
      .describe("Issuer of the source asset. Omit for native XLM."),
    destinationAssetCode: z
      .string()
      .describe('Destination asset code, e.g. "USDC" or "yXLM".'),
    destinationAssetIssuer: z
      .string()
      .optional()
      .describe("Issuer of the destination asset. Omit for native XLM."),
    amount: z
      .string()
      .describe(
        "Amount to send (strict_send) or receive (strict_receive), as a decimal string, e.g. '100.0'."
      ),
    sourceAccount: z
      .string()
      .optional()
      .describe(
        "Source account G-address. Improves path quality when provided " +
          "(Horizon filters to paths that account can actually use)."
      ),
    destinationAccount: z
      .string()
      .optional()
      .describe(
        "Destination account G-address. Required for strict_receive mode."
      ),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Stellar network to query. Defaults to testnet."),
  }),
  func: async ({
    mode,
    sourceAssetCode,
    sourceAssetIssuer,
    destinationAssetCode,
    destinationAssetIssuer,
    amount,
    sourceAccount,
    destinationAccount,
    network,
  }: {
    mode: "strict_send" | "strict_receive";
    sourceAssetCode: string;
    sourceAssetIssuer?: string;
    destinationAssetCode: string;
    destinationAssetIssuer?: string;
    amount: string;
    sourceAccount?: string;
    destinationAccount?: string;
    network: "testnet" | "mainnet";
  }) => {
    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const server = new StellarSdk.Horizon.Server(horizonUrl);

    // Resolve assets
    const resolveAsset = (code: string, issuer?: string): StellarSdk.Asset => {
      if (code.toUpperCase() === "XLM" && !issuer)
        return StellarSdk.Asset.native();
      return new StellarSdk.Asset(code, issuer!);
    };

    let sourceAsset: StellarSdk.Asset;
    let destAsset: StellarSdk.Asset;

    try {
      sourceAsset = resolveAsset(sourceAssetCode, sourceAssetIssuer);
      destAsset = resolveAsset(destinationAssetCode, destinationAssetIssuer);
    } catch (e) {
      return JSON.stringify({
        success: false,
        error: `Asset resolution failed: ${(e as Error).message}`,
      });
    }

    // Validate amount is a positive decimal
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return JSON.stringify({
        success: false,
        error: `Invalid amount "${amount}". Must be a positive decimal number.`,
      });
    }

    try {
      let paths: StellarSdk.Horizon.ServerApi.PaymentPathRecord[];

      if (mode === "strict_send") {
        const builder = server.strictSendPaths(sourceAsset, amount, [destAsset]);
        const response = await builder.call();
        paths = response.records;
      } else {
        if (!destinationAccount) {
          return JSON.stringify({
            success: false,
            error:
              "strict_receive mode requires a destinationAccount to be provided.",
          });
        }
        const builder = server.strictReceivePaths(
          sourceAccount ? [sourceAsset] : [sourceAsset],
          destAsset,
          amount
        );
        const response = await builder.call();
        paths = response.records;
      }

      if (paths.length === 0) {
        return JSON.stringify({
          success: true,
          network,
          mode,
          pathsFound: 0,
          message:
            "No payment paths found for this asset pair and amount. " +
            "The assets may not have a DEX trading route, or there is insufficient liquidity.",
          paths: [],
        });
      }

      const formattedPaths = paths.map((p, i) => ({
        rank: i + 1,
        sourceAsset: p.source_asset_type === "native"
          ? "XLM (native)"
          : `${p.source_asset_code}:${p.source_asset_issuer}`,
        destinationAsset: p.destination_asset_type === "native"
          ? "XLM (native)"
          : `${p.destination_asset_code}:${p.destination_asset_issuer}`,
        sourceAmount: p.source_amount,
        destinationAmount: p.destination_amount,
        // Intermediate hops (empty = direct swap)
        path: p.path.map((hop) =>
          hop.asset_type === "native"
            ? "XLM (native)"
            : `${hop.asset_code}:${hop.asset_issuer}`
        ),
        hopCount: p.path.length,
        isDirect: p.path.length === 0,
      }));

      return JSON.stringify(
        {
          success: true,
          network,
          mode,
          requestedAmount: amount,
          pathsFound: formattedPaths.length,
          // Best path is first in the array (Horizon ranks by best rate)
          bestPath: formattedPaths[0],
          allPaths: formattedPaths,
        },
        null,
        2
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        success: false,
        error: `Path-finding request failed: ${message}`,
      });
    }
  },
});

export default findPaymentPathsTool;
