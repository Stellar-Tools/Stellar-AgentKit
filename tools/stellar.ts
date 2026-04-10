import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { sendPayment } from "../lib/payments";
import type { StellarAssetInput } from "../lib/assets";

const nativeAssetSchema = z.object({
  type: z.literal("native"),
});

const issuedAssetSchema = z.object({
  code: z.string().min(1).max(12),
  issuer: z.string().min(1),
});

const assetSchema = z.union([nativeAssetSchema, issuedAssetSchema]);

export const stellarSendPaymentTool = new DynamicStructuredTool({
  name: "stellar_send_payment",
  description:
    "Send native XLM or issued-asset payments on Stellar Classic. " +
    "Supports optional memos and can fund brand-new accounts with native XLM.",
  schema: z.object({
    recipient: z.string().describe("The Stellar public key to send to"),
    amount: z.string().describe("The amount to send as a Stellar amount string"),
    asset: assetSchema
      .optional()
      .describe("Optional asset descriptor. Omit to send native XLM."),
    memo: z
      .string()
      .max(28)
      .optional()
      .describe("Optional text memo up to 28 bytes"),
    network: z
      .enum(["testnet", "mainnet"])
      .optional()
      .describe("Target Stellar network. Defaults to testnet."),
    horizonUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional Horizon URL override"),
    allowMainnet: z
      .boolean()
      .optional()
      .describe("Required when network is mainnet"),
  }),
  func: async ({
    recipient,
    amount,
    asset,
    memo,
    network,
    horizonUrl,
    allowMainnet,
  }: {
    recipient: string;
    amount: string;
    asset?: StellarAssetInput;
    memo?: string;
    network?: "testnet" | "mainnet";
    horizonUrl?: string;
    allowMainnet?: boolean;
  }) => {
    const selectedNetwork = network ?? "testnet";
    if (selectedNetwork === "mainnet" && !allowMainnet) {
      throw new Error("allowMainnet: true is required for mainnet payments");
    }

    const publicKey = process.env.STELLAR_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("Missing STELLAR_PUBLIC_KEY");
    }

    const result = await sendPayment(
      {
        network: selectedNetwork,
        horizonUrl:
          horizonUrl ??
          (selectedNetwork === "mainnet"
            ? "https://horizon.stellar.org"
            : "https://horizon-testnet.stellar.org"),
        publicKey,
      },
      {
        destination: recipient,
        amount,
        asset,
        memo,
      }
    );

    return JSON.stringify(result, null, 2);
  },
});
