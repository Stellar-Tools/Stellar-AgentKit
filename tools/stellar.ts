import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "stellar-sdk";

/**
 * stellar_send_payment — Send XLM or any Stellar asset to another account.
 *
 * Supports:
 * - Native XLM payments
 * - Custom asset payments (asset_code + asset_issuer)
 * - Optional memo (text)
 * - Testnet and Mainnet (mainnet requires ALLOW_MAINNET=true env var)
 */
export const stellarSendPaymentTool = new DynamicStructuredTool({
  name: "stellar_send_payment",
  description:
    "Send XLM or a custom Stellar asset to another account. Supports native XLM and issued tokens. " +
    "For mainnet, set ALLOW_MAINNET=true in your environment. Requires STELLAR_PRIVATE_KEY env var.",
  schema: z.object({
    recipient: z
      .string()
      .describe("The Stellar address (G...) to send payment to"),
    amount: z
      .string()
      .describe("The amount to send as a string (e.g. '100' or '0.5')"),
    asset_code: z
      .string()
      .optional()
      .describe(
        "Asset code for custom tokens (e.g. 'USDC'). Leave empty for native XLM."
      ),
    asset_issuer: z
      .string()
      .optional()
      .describe(
        "Issuer public key for custom tokens. Required when asset_code is provided."
      ),
    memo: z
      .string()
      .optional()
      .describe("Optional text memo to attach to the transaction (max 28 bytes)"),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Network to send on. Mainnet requires ALLOW_MAINNET=true env var."),
  }),
  func: async ({
    recipient,
    amount,
    asset_code,
    asset_issuer,
    memo,
    network = "testnet",
  }: {
    recipient: string;
    amount: string;
    asset_code?: string;
    asset_issuer?: string;
    memo?: string;
    network?: "testnet" | "mainnet";
  }) => {
    try {
      // ── Mainnet safety gate ──────────────────────────────────────
      if (network === "mainnet" && process.env.ALLOW_MAINNET !== "true") {
        throw new Error(
          "🚫 Mainnet payment blocked for safety.\n" +
          "Set ALLOW_MAINNET=true in your environment to enable mainnet operations.\n" +
          "Double-check all parameters before proceeding with real funds."
        );
      }

      // ── Input validation ─────────────────────────────────────────
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
        throw new Error(`Invalid recipient address: ${recipient.slice(0, 8)}...`);
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Amount must be a positive number.");
      }
      if (asset_code && !asset_issuer) {
        throw new Error("asset_issuer is required when asset_code is provided.");
      }
      if (asset_issuer && !StellarSdk.StrKey.isValidEd25519PublicKey(asset_issuer)) {
        throw new Error(`Invalid asset_issuer address: ${asset_issuer.slice(0, 8)}...`);
      }
      if (memo && Buffer.byteLength(memo, "utf8") > 28) {
        throw new Error("Memo text exceeds 28 bytes limit.");
      }

      // ── Load sender account ──────────────────────────────────────
      const privateKey = process.env.STELLAR_PRIVATE_KEY as string;
      if (!privateKey || !StellarSdk.StrKey.isValidEd25519SecretSeed(privateKey)) {
        throw new Error("Invalid or missing STELLAR_PRIVATE_KEY in environment.");
      }
      const keypair = StellarSdk.Keypair.fromSecret(privateKey);
      const sourcePublicKey = keypair.publicKey();

      const horizonUrl =
        network === "mainnet"
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org";
      const networkPassphrase =
        network === "mainnet"
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;

      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(sourcePublicKey);

      // ── Resolve asset ────────────────────────────────────────────
      const asset =
        asset_code && asset_issuer
          ? new StellarSdk.Asset(asset_code, asset_issuer)
          : StellarSdk.Asset.native();

      // ── Build transaction ────────────────────────────────────────
      const txBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      }).addOperation(
        StellarSdk.Operation.payment({
          destination: recipient,
          asset,
          amount,
        })
      );

      if (memo) {
        txBuilder.addMemo(StellarSdk.Memo.text(memo));
      }

      const transaction = txBuilder.setTimeout(300).build();
      transaction.sign(keypair);

      // ── Submit ───────────────────────────────────────────────────
      const response = await server.submitTransaction(transaction);

      return JSON.stringify({
        success: true,
        hash: response.hash,
        network,
        from: sourcePublicKey,
        to: recipient,
        amount,
        asset: asset_code ? `${asset_code}:${asset_issuer}` : "XLM",
        memo: memo || null,
      });
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { title?: string; extras?: unknown } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error occurred";
      return JSON.stringify({
        success: false,
        error: errorMessage,
        network,
        recipient: recipient.slice(0, 8) + "...",
        amount,
        asset: asset_code ? `${asset_code}` : "XLM",
      });
    }
  },
});
