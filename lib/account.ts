import { Horizon, StrKey } from "@stellar/stellar-sdk";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccountClientConfig {
  network: "testnet" | "mainnet";
  horizonUrl?: string;
}

/** @internal Dependencies for testing */
export interface AccountDeps {
  createServer?: (horizonUrl: string) => any;
}

export interface AccountBalance {
  assetType: string;
  assetCode?: string;
  assetIssuer?: string;
  balance: string;
  /** Only present for non-native assets */
  limit?: string;
  buyingLiabilities: string;
  sellingLiabilities: string;
}

export interface AccountInfo {
  id: string;
  accountId: string;
  sequence: string;
  subentryCount: number;
  balances: AccountBalance[];
  signers: AccountSigner[];
  thresholds: {
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
  };
  flags: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
    authClawbackEnabled: boolean;
  };
  homeDomain?: string;
  lastModifiedLedger: number;
  numSponsored: number;
  numSponsoring: number;
}

export interface AccountSigner {
  key: string;
  weight: number;
  type: string;
}

export interface TransactionRecord {
  id: string;
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  feeCharged: string;
  operationCount: number;
  memoType: string;
  memo?: string;
  successful: boolean;
}

export interface OperationRecord {
  id: string;
  type: string;
  createdAt: string;
  transactionHash: string;
  sourceAccount: string;
  details: Record<string, unknown>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHorizonUrl(config: AccountClientConfig): string {
  return (
    config.horizonUrl ??
    (config.network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org")
  );
}

function createServer(config: AccountClientConfig): Horizon.Server {
  return new Horizon.Server(getHorizonUrl(config));
}

function validatePublicKey(publicKey: string): void {
  if (!publicKey || !StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error(
      `Invalid Stellar public key: ${publicKey || "(empty)"}. ` +
      `Stellar public keys must start with 'G' and be 56 characters long.`
    );
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Retrieve comprehensive information about a Stellar account.
 *
 * Returns balances (XLM + custom assets), signers, thresholds, flags,
 * home domain, and sponsorship metadata.
 *
 * @param publicKey - The Stellar G-address to query
 * @param config    - Network and optional Horizon URL
 */
export async function getAccountInfo(
  publicKey: string,
  config: AccountClientConfig,
  _deps: AccountDeps = {}
): Promise<AccountInfo> {
  validatePublicKey(publicKey);

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  let account: Horizon.ServerApi.AccountRecord;
  try {
    account = await server.accounts().accountId(publicKey).call();
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new Error(
        `Account ${publicKey} not found on ${config.network}. ` +
        `The account may not be funded yet.`
      );
    }
    throw new Error(
      `Failed to fetch account info: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const balances: AccountBalance[] = account.balances.map(
    (b: Horizon.HorizonApi.BalanceLine) => {
      const base: AccountBalance = {
        assetType: b.asset_type,
        balance: b.balance,
        buyingLiabilities: b.buying_liabilities,
        sellingLiabilities: b.selling_liabilities,
      };

      if (b.asset_type !== "native" && b.asset_type !== "liquidity_pool_shares") {
        const issuedBalance = b as Horizon.HorizonApi.BalanceLineAsset;
        base.assetCode = issuedBalance.asset_code;
        base.assetIssuer = issuedBalance.asset_issuer;
        base.limit = issuedBalance.limit;
      }

      return base;
    }
  );

  const signers: AccountSigner[] = account.signers.map((s: any) => ({
    key: s.key,
    weight: s.weight,
    type: s.type,
  }));

  return {
    id: account.id,
    accountId: account.account_id,
    sequence: account.sequence,
    subentryCount: account.subentry_count,
    balances,
    signers,
    thresholds: {
      lowThreshold: account.thresholds.low_threshold,
      medThreshold: account.thresholds.med_threshold,
      highThreshold: account.thresholds.high_threshold,
    },
    flags: {
      authRequired: account.flags.auth_required,
      authRevocable: account.flags.auth_revocable,
      authImmutable: account.flags.auth_immutable,
      authClawbackEnabled: account.flags.auth_clawback_enabled,
    },
    homeDomain: account.home_domain,
    lastModifiedLedger: account.last_modified_ledger,
    numSponsored: account.num_sponsored,
    numSponsoring: account.num_sponsoring,
  };
}

/**
 * Retrieve the balances for a Stellar account.
 *
 * Convenience wrapper around `getAccountInfo` that returns only the
 * balance entries, making it easier for agents to quickly check
 * available funds.
 *
 * @param publicKey - The Stellar G-address to query
 * @param config    - Network and optional Horizon URL
 */
export async function getBalances(
  publicKey: string,
  config: AccountClientConfig,
  _deps: AccountDeps = {}
): Promise<AccountBalance[]> {
  const info = await getAccountInfo(publicKey, config, _deps);
  return info.balances;
}

/**
 * Retrieve recent transaction history for a Stellar account.
 *
 * Paginates through Horizon and returns up to `limit` transactions,
 * ordered from most recent to oldest.
 *
 * @param publicKey - The Stellar G-address to query
 * @param config    - Network and optional Horizon URL
 * @param limit     - Maximum number of transactions to return (default 10, max 50)
 * @param order     - Sort order: "desc" (newest first) or "asc" (oldest first)
 */
export async function getTransactionHistory(
  publicKey: string,
  config: AccountClientConfig,
  limit: number = 10,
  order: "asc" | "desc" = "desc",
  _deps: AccountDeps = {}
): Promise<TransactionRecord[]> {
  validatePublicKey(publicKey);

  if (limit < 1 || limit > 50) {
    throw new Error("limit must be between 1 and 50");
  }

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  let response;
  try {
    response = await server
      .transactions()
      .forAccount(publicKey)
      .order(order)
      .limit(limit)
      .call();
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new Error(
        `Account ${publicKey} not found on ${config.network}. ` +
        `The account may not be funded yet.`
      );
    }
    throw new Error(
      `Failed to fetch transaction history: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return response.records.map((tx: any) => ({
    id: tx.id,
    hash: tx.hash,
    ledger: tx.ledger,
    createdAt: tx.created_at,
    sourceAccount: tx.source_account,
    feeCharged: tx.fee_charged,
    operationCount: tx.operation_count,
    memoType: tx.memo_type,
    memo: tx.memo,
    successful: tx.successful,
  }));
}

/**
 * Retrieve recent operation history for a Stellar account.
 *
 * Operations include payments, path payments, trust changes, offers,
 * account merges, and more.
 *
 * @param publicKey - The Stellar G-address to query
 * @param config    - Network and optional Horizon URL
 * @param limit     - Maximum number of operations to return (default 10, max 50)
 * @param order     - Sort order: "desc" (newest first) or "asc" (oldest first)
 */
export async function getOperationHistory(
  publicKey: string,
  config: AccountClientConfig,
  limit: number = 10,
  order: "asc" | "desc" = "desc",
  _deps: AccountDeps = {}
): Promise<OperationRecord[]> {
  validatePublicKey(publicKey);

  if (limit < 1 || limit > 50) {
    throw new Error("limit must be between 1 and 50");
  }

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  let response;
  try {
    response = await server
      .operations()
      .forAccount(publicKey)
      .order(order)
      .limit(limit)
      .call();
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new Error(
        `Account ${publicKey} not found on ${config.network}. ` +
        `The account may not be funded yet.`
      );
    }
    throw new Error(
      `Failed to fetch operation history: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return response.records.map((op: any) => {
    // Extract operation-specific details, omitting Horizon metadata fields
    const {
      _links,
      id,
      type,
      type_i,
      created_at,
      transaction_hash,
      source_account,
      paging_token,
      transaction_successful,
      ...details
    } = op;

    return {
      id: String(id),
      type: type,
      createdAt: created_at,
      transactionHash: transaction_hash,
      sourceAccount: source_account,
      details,
    };
  });
}

/**
 * Fund a testnet account using Stellar Friendbot.
 *
 * This only works on the Stellar testnet. It will create and fund
 * the account with 10,000 test XLM.
 *
 * @param publicKey - The Stellar G-address to fund
 * @param fetchImpl - Optional fetch implementation (for testing)
 */
export async function fundTestnetAccount(
  publicKey: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ success: boolean; message: string }> {
  validatePublicKey(publicKey);

  if (!fetchImpl) {
    throw new Error("Global fetch is not available in this environment");
  }

  const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;

  try {
    const response = await fetchImpl(friendbotUrl);

    if (!response.ok) {
      const body = await response.text();
      // Friendbot returns a specific error when already funded
      if (body.includes("createAccountAlreadyExist")) {
        return {
          success: false,
          message: `Account ${publicKey} has already been funded on testnet.`,
        };
      }
      throw new Error(`Friendbot request failed: ${response.status} ${response.statusText}`);
    }

    return {
      success: true,
      message: `Account ${publicKey} has been funded with 10,000 test XLM on Stellar testnet.`,
    };
  } catch (error: any) {
    if (error.message?.includes("Friendbot request failed")) {
      throw error;
    }
    throw new Error(
      `Failed to fund testnet account: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
