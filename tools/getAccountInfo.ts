import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Tool: getAccountInfo
 *
 * Retrieves detailed on-chain account information for a given Stellar public key.
 * Returns balances across all assets (native XLM + issued tokens), sequence number,
 * subentry count, signers, flags, and thresholds. Useful for pre-flight checks
 * before submitting swaps, payments, or LP operations.
 *
 * @param publicKey - The Stellar G-address of the account to inspect
 * @param network   - "testnet" | "mainnet" (defaults to "testnet")
 */
const getAccountInfoTool = new DynamicStructuredTool({
  name: "get_account_info",
  description:
    "Fetch detailed Stellar account information including all asset balances, " +
    "sequence number, subentry count, signers, account flags, and thresholds. " +
    "Use this before initiating swaps, payments, or LP operations to verify " +
    "the account exists, is funded, and has the necessary trustlines.",
  schema: z.object({
    publicKey: z
      .string()
      .describe("The Stellar public key (G-address) of the account to inspect"),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("The Stellar network to query. Defaults to testnet."),
  }),
  func: async ({
    publicKey,
    network,
  }: {
    publicKey: string;
    network: "testnet" | "mainnet";
  }) => {
    // Validate the public key before making a network call
    try {
      StellarSdk.Keypair.fromPublicKey(publicKey);
    } catch {
      return JSON.stringify({
        success: false,
        error: `Invalid Stellar public key: "${publicKey}". Must be a valid G-address.`,
      });
    }

    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const server = new StellarSdk.Horizon.Server(horizonUrl);

    try {
      const account = await server.loadAccount(publicKey);

      // Shape balances into a clean, agent-readable format
      const balances = account.balances.map((b) => {
        if (b.asset_type === "native") {
          return {
            asset: "XLM (native)",
            balance: b.balance,
            buyingLiabilities: b.buying_liabilities,
            sellingLiabilities: b.selling_liabilities,
          };
        } else if (
          b.asset_type === "credit_alphanum4" ||
          b.asset_type === "credit_alphanum12"
        ) {
          return {
            asset: `${b.asset_code}:${b.asset_issuer}`,
            balance: b.balance,
            limit: b.limit,
            buyingLiabilities: b.buying_liabilities,
            sellingLiabilities: b.selling_liabilities,
            isAuthorized: b.is_authorized,
          };
        } else if (b.asset_type === "liquidity_pool_shares") {
          return {
            asset: `LP shares (pool: ${b.liquidity_pool_id})`,
            balance: b.balance,
            limit: b.limit,
          };
        }
        return b;
      });

      const result = {
        success: true,
        publicKey: account.accountId(),
        network,
        sequenceNumber: account.sequenceNumber(),
        subentryCount: account.subentry_count,
        numSponsored: account.num_sponsored,
        numSponsoring: account.num_sponsoring,
        balances,
        signers: account.signers.map((s) => ({
          key: s.key,
          weight: s.weight,
          type: s.type,
        })),
        thresholds: account.thresholds,
        flags: account.flags,
        homeDomain: account.home_domain || null,
        lastModifiedLedger: account.last_modified_ledger,
      };

      return JSON.stringify(result, null, 2);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return JSON.stringify({
          success: false,
          error: `Account "${publicKey}" not found on ${network}. It may not be funded yet.`,
        });
      }
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        success: false,
        error: `Failed to load account: ${message}`,
      });
    }
  },
});

export default getAccountInfoTool;
