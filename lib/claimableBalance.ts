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
 * and time-locked payments (escrow, vesting, scheduled payouts). They are
 * particularly useful for AI-agent workflows where funds must be released
 * upon predicates (e.g. "after 24h", "before deadline", "on demand").
 *
 * @see https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/claimable-balances
 */

export type NetworkName = "testnet" | "mainnet";

export interface ClaimableBalanceContext {
  network: NetworkName;
  horizonUrl: string;
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
}

export interface CreateClaimableBalanceResult {
  transactionHash: string;
  /** Claimable balance IDs (hex) created by this transaction. */
  balanceIds: string[];
}

export interface ClaimClaimableBalanceParams {
  claimerSecret: string;
  balanceId: string;
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

/**
 * Stellar's per-balance protocol limit on claimants for a single
 * CreateClaimableBalance operation. We currently emit one operation per input
 * claimant (so each resulting balance has exactly one claimant), meaning this
 * constant is informational and NOT used to cap the input array length.
 */
export const MAX_CLAIMANTS_PER_BALANCE = 10;

/**
 * Stellar's protocol cap on operations per transaction. Since we emit one
 * CreateClaimableBalance op per input claimant, this is the effective upper
 * bound on the size of the `claimants` array in a single call.
 */
const MAX_OPERATIONS_PER_TRANSACTION = 100;

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

/**
 * Build a Stellar SDK xdr.ClaimPredicate from the friendly tagged union.
 *
 * Validates inputs (positive durations, balanced compound predicates, depth)
 * to prevent accidentally creating unclaimable balances.
 */
export function buildPredicate(
  predicate: ClaimPredicate | undefined,
  depth = 0
): xdr.ClaimPredicate {
  if (depth > 5) {
    throw new Error("Claim predicate nesting too deep (max 5 levels)");
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
      return Claimant.predicateNot(buildPredicate(predicate.predicate, depth + 1));
    }
    case "and": {
      if (!predicate.predicates || predicate.predicates.length !== 2) {
        throw new Error("`and` predicate requires exactly 2 inner predicates");
      }
      return Claimant.predicateAnd(
        buildPredicate(predicate.predicates[0], depth + 1),
        buildPredicate(predicate.predicates[1], depth + 1)
      );
    }
    case "or": {
      if (!predicate.predicates || predicate.predicates.length !== 2) {
        throw new Error("`or` predicate requires exactly 2 inner predicates");
      }
      return Claimant.predicateOr(
        buildPredicate(predicate.predicates[0], depth + 1),
        buildPredicate(predicate.predicates[1], depth + 1)
      );
    }
    default: {
      const exhaustive: never = predicate;
      throw new Error(`Unsupported predicate type: ${JSON.stringify(exhaustive)}`);
    }
  }
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
 * Extract the claimable balance IDs created by a CreateClaimableBalance op
 * from the transaction's operation result XDR.
 */
export function extractBalanceIdsFromTransactionResult(
  resultXdr: string
): string[] {
  const ids: string[] = [];
  let parsed: xdr.TransactionResult;
  try {
    parsed = xdr.TransactionResult.fromXDR(resultXdr, "base64");
  } catch (err) {
    return ids;
  }

  const inner = parsed.result();
  if (inner.switch().name !== "txSuccess" && inner.switch().name !== "txFeeBumpInnerSuccess") {
    return ids;
  }

  const opResults =
    inner.switch().name === "txFeeBumpInnerSuccess"
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

/**
 * Create one or more claimable balances in a single transaction.
 *
 * Each claimant + predicate becomes its own CreateClaimableBalance operation
 * so the resulting balance IDs map 1:1 with the input claimants array.
 */
export async function createClaimableBalance(
  ctx: ClaimableBalanceContext,
  params: CreateClaimableBalanceParams
): Promise<CreateClaimableBalanceResult> {
  if (!params.sourceSecret) {
    throw new Error("sourceSecret is required");
  }
  if (!params.claimants || params.claimants.length === 0) {
    throw new Error("At least one claimant is required");
  }
  if (params.claimants.length > MAX_OPERATIONS_PER_TRANSACTION) {
    throw new Error(
      `A single transaction supports at most ${MAX_OPERATIONS_PER_TRANSACTION} claimable-balance operations ` +
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
    (c) => new Claimant(c.destination, buildPredicate(c.predicate))
  );

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
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

  const tx = builder.setTimeout(180).build();
  tx.sign(sourceKp);

  const result = await server.submitTransaction(tx);
  const resultXdr =
    (result as unknown as { result_xdr?: string }).result_xdr ?? "";
  const balanceIds = resultXdr
    ? extractBalanceIdsFromTransactionResult(resultXdr)
    : [];

  return { transactionHash: result.hash, balanceIds };
}

/**
 * Claim a previously created claimable balance.
 */
export async function claimClaimableBalance(
  ctx: ClaimableBalanceContext,
  params: ClaimClaimableBalanceParams
): Promise<ClaimClaimableBalanceResult> {
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
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.claimClaimableBalance({ balanceId: params.balanceId })
    )
    .setTimeout(180)
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
