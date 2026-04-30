import {
  Asset,
  BASE_FEE,
  Claimant,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

/**
 * Claimable Balance support for Stellar AgentKit.
 *
 * Claimable Balances are a unique Stellar primitive that enable conditional
 * and time-locked payments — escrow, vesting, scheduled payouts, conditional
 * disbursements. They are particularly useful for AI-agent workflows where
 * funds must be released upon predicates (e.g. "after 24h", "before deadline",
 * "on demand").
 *
 * @see https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/claimable-balances
 */

// ─── Public configuration constants ──────────────────────────────────────
//
// These values reflect the Stellar protocol limits at the time of writing.
// They are exported (and overridable via call-site `options`) so that
// downstream code is not hard-coded against magic numbers.

/**
 * Stellar's per-balance protocol limit on claimants for a single
 * `CreateClaimableBalance` operation.
 *
 * NOTE: `createClaimableBalance` below emits one operation per *input*
 * claimant (so each resulting balance has exactly one claimant), which means
 * this constant is informational for the public API — it is not used to cap
 * the size of the `claimants` argument.
 */
export const MAX_CLAIMANTS_PER_BALANCE = 10;

/**
 * Stellar's protocol cap on operations per transaction.
 *
 * `createClaimableBalance` emits one `CreateClaimableBalance` op per input
 * claimant, so this is the effective default upper bound on the size of the
 * `claimants` array in a single call. Override via `options.maxOperationsPerTransaction`.
 */
export const MAX_OPERATIONS_PER_TRANSACTION = 100;

/** Maximum allowed depth of compound (and / or / not) claim predicates. */
export const MAX_PREDICATE_DEPTH = 5;

/** Default transaction time-bound for create / claim transactions, in seconds. */
export const DEFAULT_TRANSACTION_TIMEOUT_SECONDS = 180;

// ─── Types ───────────────────────────────────────────────────────────────

export type NetworkName = "testnet" | "mainnet";

export interface ClaimableBalanceContext {
  network: NetworkName;
  horizonUrl: string;
}

/** Behaviour-tweaking options shared by the public API entry points. */
export interface ClaimableBalanceOptions {
  /** Override the per-tx operation cap. Defaults to `MAX_OPERATIONS_PER_TRANSACTION`. */
  maxOperationsPerTransaction?: number;
  /** Override the predicate nesting depth limit. Defaults to `MAX_PREDICATE_DEPTH`. */
  maxPredicateDepth?: number;
  /** Override the transaction timeout (seconds). Defaults to `DEFAULT_TRANSACTION_TIMEOUT_SECONDS`. */
  transactionTimeoutSeconds?: number;
  /** Override the per-op base fee (stroops). Defaults to `BASE_FEE`. */
  baseFee?: string;
}

/**
 * High-level predicate definition. Mirrors the on-chain semantics but is
 * expressed as a friendly tagged union for ergonomic use from agent code.
 */
export type ClaimPredicate =
  | { type: "unconditional" }
  | { type: "beforeRelativeTime"; seconds: number | string }
  | { type: "beforeAbsoluteTime"; epochSeconds: number | string }
  | { type: "not"; predicate: ClaimPredicate }
  | { type: "and"; predicates: [ClaimPredicate, ClaimPredicate] }
  | { type: "or"; predicates: [ClaimPredicate, ClaimPredicate] };

export interface ClaimantInput {
  destination: string;
  predicate?: ClaimPredicate;
}

export interface AssetInput {
  code: string;
  issuer?: string;
}

export interface CreateClaimableBalanceParams {
  sourceSecret: string;
  asset: AssetInput;
  amount: string;
  claimants: ClaimantInput[];
  options?: ClaimableBalanceOptions;
}

export interface CreateClaimableBalanceResult {
  transactionHash: string;
  /** Claimable balance IDs (hex) created by this transaction. */
  balanceIds: string[];
}

export interface ClaimClaimableBalanceParams {
  claimerSecret: string;
  balanceId: string;
  options?: ClaimableBalanceOptions;
}

export interface ClaimClaimableBalanceResult {
  transactionHash: string;
  balanceId: string;
}

export interface ListClaimableBalancesParams {
  claimant?: string;
  sponsor?: string;
  asset?: AssetInput;
  limit?: number;
  cursor?: string;
}

export interface ClaimableBalanceRecord {
  id: string;
  asset: string;
  amount: string;
  sponsor?: string;
  lastModifiedLedger: number;
  claimants: Array<{ destination: string; predicate: unknown }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getNetworkPassphrase(network: NetworkName): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function toAsset(input: AssetInput): Asset {
  if (!input || !input.code) {
    throw new Error("Asset code is required");
  }
  if (input.code.toUpperCase() === "XLM" || input.code === "native") {
    return Asset.native();
  }
  if (!input.issuer) {
    throw new Error(`Asset ${input.code} requires an issuer`);
  }
  return new Asset(input.code, input.issuer);
}

function validateAmount(amount: string): void {
  if (typeof amount !== "string" || amount.trim() === "") {
    throw new Error("amount must be a non-empty string");
  }
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
    throw new Error(
      "amount must be a positive decimal with up to 7 fractional digits"
    );
  }
  if (Number(amount) <= 0) {
    throw new Error("amount must be greater than zero");
  }
}

/**
 * Build a Stellar SDK xdr.ClaimPredicate from the friendly tagged union.
 *
 * Validates inputs (positive durations, balanced compound predicates, depth)
 * to prevent accidentally creating unclaimable balances.
 */
export function buildPredicate(
  predicate: ClaimPredicate | undefined,
  depth = 0,
  maxDepth: number = MAX_PREDICATE_DEPTH
): xdr.ClaimPredicate {
  if (depth > maxDepth) {
    throw new Error(`Claim predicate nesting too deep (max ${maxDepth} levels)`);
  }
  if (!predicate || predicate.type === "unconditional") {
    return Claimant.predicateUnconditional();
  }

  switch (predicate.type) {
    case "beforeRelativeTime": {
      const seconds = String(predicate.seconds);
      if (!/^\d+$/.test(seconds) || Number(seconds) <= 0) {
        throw new Error("beforeRelativeTime.seconds must be a positive integer");
      }
      return Claimant.predicateBeforeRelativeTime(seconds);
    }
    case "beforeAbsoluteTime": {
      const epoch = String(predicate.epochSeconds);
      if (!/^\d+$/.test(epoch) || Number(epoch) <= 0) {
        throw new Error(
          "beforeAbsoluteTime.epochSeconds must be a positive integer"
        );
      }
      return Claimant.predicateBeforeAbsoluteTime(epoch);
    }
    case "not": {
      if (!predicate.predicate) {
        throw new Error("`not` predicate requires an inner predicate");
      }
      return Claimant.predicateNot(
        buildPredicate(predicate.predicate, depth + 1, maxDepth)
      );
    }
    case "and": {
      if (!predicate.predicates || predicate.predicates.length !== 2) {
        throw new Error("`and` predicate requires exactly 2 inner predicates");
      }
      return Claimant.predicateAnd(
        buildPredicate(predicate.predicates[0], depth + 1, maxDepth),
        buildPredicate(predicate.predicates[1], depth + 1, maxDepth)
      );
    }
    case "or": {
      if (!predicate.predicates || predicate.predicates.length !== 2) {
        throw new Error("`or` predicate requires exactly 2 inner predicates");
      }
      return Claimant.predicateOr(
        buildPredicate(predicate.predicates[0], depth + 1, maxDepth),
        buildPredicate(predicate.predicates[1], depth + 1, maxDepth)
      );
    }
    default: {
      const exhaustive: never = predicate;
      throw new Error(`Unsupported predicate type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Extract the claimable balance IDs created by a CreateClaimableBalance op
 * from the transaction's operation result XDR.
 */
export function extractBalanceIdsFromTransactionResult(
  resultXdr: string
): string[] {
  const ids: string[] = [];
  if (!resultXdr) return ids;

  let parsed: xdr.TransactionResult;
  try {
    parsed = xdr.TransactionResult.fromXDR(resultXdr, "base64");
  } catch (err) {
    return ids;
  }

  const inner = parsed.result();
  const switchName = inner.switch().name;
  if (switchName !== "txSuccess" && switchName !== "txFeeBumpInnerSuccess") {
    return ids;
  }

  const opResults =
    switchName === "txFeeBumpInnerSuccess"
      ? inner.innerResultPair().result().result().results()
      : inner.results();

  for (const op of opResults) {
    const tr = op.tr();
    if (!tr || tr.switch().name !== "createClaimableBalance") continue;
    const cbResult = tr.createClaimableBalanceResult();
    if (cbResult.switch().name !== "createClaimableBalanceSuccess") continue;
    const balanceId = cbResult.balanceId();
    ids.push(balanceId.toXDR("hex"));
  }

  return ids;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Create one or more claimable balances in a single transaction.
 *
 * Each claimant + predicate becomes its own `CreateClaimableBalance` operation
 * so the resulting balance IDs map 1:1 with the input `claimants` array. The
 * effective upper bound on the array length is the operations-per-transaction
 * cap (`MAX_OPERATIONS_PER_TRANSACTION`, overridable via `options`).
 */
export async function createClaimableBalance(
  ctx: ClaimableBalanceContext,
  params: CreateClaimableBalanceParams
): Promise<CreateClaimableBalanceResult> {
  const opts = params.options ?? {};
  const maxOps = opts.maxOperationsPerTransaction ?? MAX_OPERATIONS_PER_TRANSACTION;
  const maxDepth = opts.maxPredicateDepth ?? MAX_PREDICATE_DEPTH;
  const timeout = opts.transactionTimeoutSeconds ?? DEFAULT_TRANSACTION_TIMEOUT_SECONDS;
  const fee = opts.baseFee ?? BASE_FEE;

  if (!params.sourceSecret) {
    throw new Error("sourceSecret is required");
  }
  if (!params.claimants || params.claimants.length === 0) {
    throw new Error("At least one claimant is required");
  }
  if (params.claimants.length > maxOps) {
    throw new Error(
      `A single transaction supports at most ${maxOps} claimable-balance operations ` +
        `(received ${params.claimants.length}). Split the request across multiple transactions.`
    );
  }
  validateAmount(params.amount);

  const sourceKp = Keypair.fromSecret(params.sourceSecret);
  const asset = toAsset(params.asset);
  const networkPassphrase = getNetworkPassphrase(ctx.network);
  const server = new Horizon.Server(ctx.horizonUrl);

  const account = await server.loadAccount(sourceKp.publicKey());

  const claimants = params.claimants.map(
    (c) => new Claimant(c.destination, buildPredicate(c.predicate, 0, maxDepth))
  );

  const builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase,
  });

  // One operation per claimant for deterministic 1:1 balanceId mapping.
  for (const claimant of claimants) {
    builder.addOperation(
      Operation.createClaimableBalance({
        asset,
        amount: params.amount,
        claimants: [claimant],
      })
    );
  }

  const tx = builder.setTimeout(timeout).build();
  tx.sign(sourceKp);

  const result = await server.submitTransaction(tx);
  const resultXdr =
    (result as unknown as { result_xdr?: string }).result_xdr ?? "";
  const balanceIds = extractBalanceIdsFromTransactionResult(resultXdr);

  return { transactionHash: result.hash, balanceIds };
}

/**
 * Claim a previously created claimable balance.
 *
 * Will fail on-chain if the predicate is not yet satisfied or the claimer is
 * not in the balance's claimant list — Horizon returns a descriptive error
 * which is propagated to the caller.
 */
export async function claimClaimableBalance(
  ctx: ClaimableBalanceContext,
  params: ClaimClaimableBalanceParams
): Promise<ClaimClaimableBalanceResult> {
  const opts = params.options ?? {};
  const timeout = opts.transactionTimeoutSeconds ?? DEFAULT_TRANSACTION_TIMEOUT_SECONDS;
  const fee = opts.baseFee ?? BASE_FEE;

  if (!params.claimerSecret) {
    throw new Error("claimerSecret is required");
  }
  if (!params.balanceId || !/^[0-9a-fA-F]+$/.test(params.balanceId)) {
    throw new Error("balanceId must be a hex string");
  }

  const claimerKp = Keypair.fromSecret(params.claimerSecret);
  const networkPassphrase = getNetworkPassphrase(ctx.network);
  const server = new Horizon.Server(ctx.horizonUrl);

  const account = await server.loadAccount(claimerKp.publicKey());

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase,
  })
    .addOperation(
      Operation.claimClaimableBalance({ balanceId: params.balanceId })
    )
    .setTimeout(timeout)
    .build();

  tx.sign(claimerKp);
  const result = await server.submitTransaction(tx);
  return { transactionHash: result.hash, balanceId: params.balanceId };
}

/**
 * List claimable balances by claimant, sponsor, or asset.
 */
export async function listClaimableBalances(
  ctx: ClaimableBalanceContext,
  params: ListClaimableBalancesParams = {}
): Promise<ClaimableBalanceRecord[]> {
  const server = new Horizon.Server(ctx.horizonUrl);
  let call = server.claimableBalances();

  if (params.claimant) call = call.claimant(params.claimant);
  if (params.sponsor) call = call.sponsor(params.sponsor);
  if (params.asset) call = call.asset(toAsset(params.asset));
  if (params.limit) call = call.limit(params.limit);
  if (params.cursor) call = call.cursor(params.cursor);

  const page = await call.call();
  return page.records.map((r: any) => ({
    id: r.id,
    asset: r.asset,
    amount: r.amount,
    sponsor: r.sponsor,
    lastModifiedLedger: r.last_modified_ledger,
    claimants: (r.claimants ?? []).map((c: any) => ({
      destination: c.destination,
      predicate: c.predicate,
    })),
  }));
}
