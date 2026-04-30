import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { quoteSwap, swapBestRoute } from "../lib/dex";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY!;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing Stellar environment variables");
}

const nativeAssetSchema = z.object({
  type: z.literal("native"),
});

const issuedAssetSchema = z.object({
  code: z.string().min(1).max(12),
  issuer: z.string().min(1),
});

const assetSchema = z.union([nativeAssetSchema, issuedAssetSchema]);

export const StellarDexTool = new DynamicStructuredTool({
  name: "stellar_dex_tool",
  description:
    "Quote and execute Stellar Classic best-route swaps using Horizon pathfinding and path payments.",
  schema: z.object({
    action: z.enum(["quote_swap", "swap_best_route"]),
    mode: z.enum(["strict-send", "strict-receive"]),
    sendAsset: assetSchema,
    destAsset: assetSchema,
    sendAmount: z.string().optional(),
    destAmount: z.string().optional(),
    destination: z.string().optional(),
    limit: z.number().int().positive().max(20).optional(),
    slippageBps: z.number().int().nonnegative().max(5000).optional(),
    network: z.enum(["testnet", "mainnet"]).optional(),
    rpcUrl: z.string().url().optional(),
    allowMainnet: z.boolean().optional(),
  }),
  func: async (input: any) => {
    const network = input.network ?? "testnet";

    if (network === "mainnet" && !input.allowMainnet) {
      throw new Error("allowMainnet: true is required for mainnet DEX actions");
    }

    const client = {
      network,
      horizonUrl:
        input.rpcUrl ??
        (network === "mainnet"
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org"),
      publicKey: STELLAR_PUBLIC_KEY,
    } as const;

    if (input.action === "quote_swap") {
      const quotes = await quoteSwap(client, {
        mode: input.mode,
        sendAsset: input.sendAsset,
        destAsset: input.destAsset,
        sendAmount: input.sendAmount,
        destAmount: input.destAmount,
        destination: input.destination,
        limit: input.limit,
      });
      return JSON.stringify(quotes, null, 2);
    }

    const result = await swapBestRoute(client, {
      mode: input.mode,
      sendAsset: input.sendAsset,
      destAsset: input.destAsset,
      sendAmount: input.sendAmount,
      destAmount: input.destAmount,
      destination: input.destination,
      slippageBps: input.slippageBps,
    });

    return JSON.stringify(result, null, 2);
  },
});
