import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  createClaimableBalance,
  claimClaimableBalance,
  listClaimableBalances,
  type ClaimPredicate,
} from "../lib/claimableBalance";

// Environment configuration. Mirrors the convention used by other tools in
// this directory (see ./contract.ts, ./bridge.ts).
const STELLAR_NETWORK =
  (process.env.STELLAR_NETWORK as "testnet" | "mainnet") || "testnet";

const DEFAULT_HORIZON_URL =
  STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

const HORIZON_URL = process.env.HORIZON_URL || DEFAULT_HORIZON_URL;

// ─── Zod schema (recursive predicate) ────────────────────────────────────
//
// We model the friendly tagged-union ClaimPredicate as a recursive Zod schema
// using `z.lazy` so the AI agent can pass nested compound predicates.

const predicateBaseSchema: z.ZodType<ClaimPredicate> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("unconditional") }),
    z.object({
      type: z.literal("beforeRelativeTime"),
      seconds: z.union([z.number(), z.string()]),
    }),
    z.object({
      type: z.literal("beforeAbsoluteTime"),
      epochSeconds: z.union([z.number(), z.string()]),
    }),
    z.object({
      type: z.literal("not"),
      predicate: predicateBaseSchema,
    }),
    z.object({
      type: z.literal("and"),
      predicates: z.tuple([predicateBaseSchema, predicateBaseSchema]),
    }),
    z.object({
      type: z.literal("or"),
      predicates: z.tuple([predicateBaseSchema, predicateBaseSchema]),
    }),
  ])
);

const assetSchema = z.object({
  code: z.string().describe("Asset code (use 'XLM' or 'native' for the native asset)"),
  issuer: z
    .string()
    .optional()
    .describe("Issuer public key (required for non-native assets)"),
});

const claimantSchema = z.object({
  destination: z.string().describe("Recipient public key"),
  predicate: predicateBaseSchema.optional().describe(
    "Optional claim predicate. Omit for unconditional. " +
      "Examples: { type: 'beforeRelativeTime', seconds: 86400 }, " +
      "{ type: 'and', predicates: [<a>, <b>] }"
  ),
});

const inputSchema = z.object({
  action: z
    .enum(["create", "claim", "list"])
    .describe(
      "Operation to perform: create a new claimable balance, claim an existing one, or list balances."
    ),
  // create
  asset: assetSchema.optional(),
  amount: z
    .string()
    .optional()
    .describe("Amount to lock (positive decimal with up to 7 fractional digits)"),
  claimants: z
    .array(claimantSchema)
    .optional()
    .describe("List of claimants with optional predicates"),
  // claim
  balanceId: z
    .string()
    .optional()
    .describe("Hex-encoded claimable balance id to claim"),
  // list
  filter: z
    .object({
      claimant: z.string().optional(),
      sponsor: z.string().optional(),
      asset: assetSchema.optional(),
      limit: z.number().int().positive().max(200).optional(),
    })
    .optional(),
});

type ToolInput = z.infer<typeof inputSchema>;

function getSecretFromEnv(varName: string): string {
  const v = process.env[varName];
  if (!v) throw new Error(`Missing ${varName} in environment`);
  return v;
}

/**
 * LangChain `DynamicStructuredTool` that exposes Stellar Claimable Balances
 * (create / claim / list) to AI agents. Read-only `list` requires no secret;
 * `create` reads `STELLAR_PRIVATE_KEY`; `claim` reads `STELLAR_CLAIMER_PRIVATE_KEY`
 * (falling back to `STELLAR_PRIVATE_KEY` if unset).
 *
 * @example agent prompt:
 *   "Lock 50 XLM for GABCD... claimable any time within the next 2 hours."
 */
export const StellarClaimableBalanceTool = new DynamicStructuredTool({
  name: "stellar_claimable_balance",
  description:
    "Create, claim, or list Stellar Claimable Balances — conditional / time-locked payments " +
    "(escrow, vesting, scheduled payouts). Supports composable predicates: unconditional, " +
    "beforeRelativeTime, beforeAbsoluteTime, and/or/not.",
  schema: inputSchema,
  func: async (input: ToolInput) => {
    const ctx = { network: STELLAR_NETWORK, horizonUrl: HORIZON_URL };

    try {
      switch (input.action) {
        case "create": {
          if (!input.asset || !input.amount || !input.claimants) {
            throw new Error(
              "`create` requires `asset`, `amount`, and `claimants`"
            );
          }
          const sourceSecret = getSecretFromEnv("STELLAR_PRIVATE_KEY");
          const result = await createClaimableBalance(ctx, {
            sourceSecret,
            asset: input.asset,
            amount: input.amount,
            claimants: input.claimants,
          });
          return JSON.stringify(
            {
              ok: true,
              transactionHash: result.transactionHash,
              balanceIds: result.balanceIds,
            },
            null,
            2
          );
        }

        case "claim": {
          if (!input.balanceId) {
            throw new Error("`claim` requires `balanceId`");
          }
          const claimerSecret =
            process.env.STELLAR_CLAIMER_PRIVATE_KEY ||
            getSecretFromEnv("STELLAR_PRIVATE_KEY");
          const result = await claimClaimableBalance(ctx, {
            claimerSecret,
            balanceId: input.balanceId,
          });
          return JSON.stringify(
            { ok: true, transactionHash: result.transactionHash },
            null,
            2
          );
        }

        case "list": {
          const records = await listClaimableBalances(ctx, input.filter ?? {});
          return JSON.stringify({ ok: true, records }, null, 2);
        }

        default: {
          // Exhaustiveness guard
          const exhaustive: never = input.action;
          throw new Error(`Unsupported action: ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { title?: string } }; message?: string })
          ?.response?.data?.title ||
        (error as Error).message ||
        "Unknown error";
      return JSON.stringify({ ok: false, error: message }, null, 2);
    }
  },
});
