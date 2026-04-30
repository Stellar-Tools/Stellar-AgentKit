import { Horizon, StrKey } from "@stellar/stellar-sdk";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AssetClientConfig {
  network: "testnet" | "mainnet";
  horizonUrl?: string;
}

/** @internal Dependencies for testing */
export interface AssetDeps {
  createServer?: (horizonUrl: string) => any;
}

export interface AssetDetails {
  assetType: string;
  assetCode: string;
  assetIssuer: string;
  pagingToken: string;
  /** Number of accounts trusting this asset */
  numAccounts: number;
  /** Amount held across all accounts */
  amount: string;
  flags: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
    authClawbackEnabled: boolean;
  };
}

export interface OrderbookSummary {
  base: { assetType: string; assetCode?: string; assetIssuer?: string };
  counter: { assetType: string; assetCode?: string; assetIssuer?: string };
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
}

export interface OrderbookEntry {
  price: string;
  amount: string;
  /** Ratio as returned by Horizon (numerator/denominator) */
  priceR: { n: number; d: number };
}

export interface TradeRecord {
  id: string;
  pagingToken: string;
  ledgerCloseTime: string;
  baseAccount?: string;
  baseAmount: string;
  baseAssetType: string;
  baseAssetCode?: string;
  baseAssetIssuer?: string;
  counterAccount?: string;
  counterAmount: string;
  counterAssetType: string;
  counterAssetCode?: string;
  counterAssetIssuer?: string;
  price: { n: string; d: string };
  baseIsSeller: boolean;
}

export type StellarAssetInput =
  | { type: "native" }
  | { code: string; issuer: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHorizonUrl(config: AssetClientConfig): string {
  return (
    config.horizonUrl ??
    (config.network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org")
  );
}

function createServer(config: AssetClientConfig): Horizon.Server {
  return new Horizon.Server(getHorizonUrl(config));
}

function validateAssetInput(asset: StellarAssetInput): void {
  if ("type" in asset) {
    if (asset.type !== "native") {
      throw new Error(`Invalid native asset type: ${asset.type}`);
    }
    return;
  }

  if (!asset.code || asset.code.length === 0 || asset.code.length > 12) {
    throw new Error(
      `Asset code must be between 1 and 12 characters, got: "${asset.code || ""}"`
    );
  }

  if (!asset.issuer || !StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error(
      `Invalid asset issuer public key: ${asset.issuer || "(empty)"}`
    );
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Look up details about a Stellar asset.
 *
 * Returns metadata including the number of accounts trusting the asset,
 * total amount in circulation, and issuer flags.
 *
 * @param assetCode   - The asset code (e.g. "USDC")
 * @param assetIssuer - The issuer's public key
 * @param config      - Network and optional Horizon URL
 */
export async function getAssetDetails(
  assetCode: string,
  assetIssuer: string,
  config: AssetClientConfig,
  _deps: AssetDeps = {}
): Promise<AssetDetails[]> {
  validateAssetInput({ code: assetCode, issuer: assetIssuer });

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  let response;
  try {
    response = await server
      .assets()
      .forCode(assetCode)
      .forIssuer(assetIssuer)
      .call();
  } catch (error: any) {
    throw new Error(
      `Failed to fetch asset details: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (response.records.length === 0) {
    throw new Error(
      `Asset ${assetCode}:${assetIssuer} not found on ${config.network}.`
    );
  }

  return response.records.map((r: any) => ({
    assetType: r.asset_type,
    assetCode: r.asset_code,
    assetIssuer: r.asset_issuer,
    pagingToken: r.paging_token,
    numAccounts: r.num_accounts,
    amount: r.amount,
    flags: {
      authRequired: r.flags.auth_required,
      authRevocable: r.flags.auth_revocable,
      authImmutable: r.flags.auth_immutable,
      authClawbackEnabled: r.flags.auth_clawback_enabled,
    },
  }));
}

/**
 * Fetch the current SDEX orderbook for a trading pair.
 *
 * Returns up to `limit` bids and asks.
 *
 * @param baseAsset    - The base asset of the trading pair
 * @param counterAsset - The counter asset of the trading pair
 * @param config       - Network and optional Horizon URL
 * @param limit        - Number of orderbook entries per side (default 10, max 200)
 */
export async function getOrderbook(
  baseAsset: StellarAssetInput,
  counterAsset: StellarAssetInput,
  config: AssetClientConfig,
  limit: number = 10,
  _deps: AssetDeps = {}
): Promise<OrderbookSummary> {
  validateAssetInput(baseAsset);
  validateAssetInput(counterAsset);

  if (limit < 1 || limit > 200) {
    throw new Error("Orderbook limit must be between 1 and 200");
  }

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  const selling = assetInputToSdkAsset(baseAsset);
  const buying = assetInputToSdkAsset(counterAsset);

  let response;
  try {
    response = await server
      .orderbook(selling, buying)
      .limit(limit)
      .call();
  } catch (error: any) {
    throw new Error(
      `Failed to fetch orderbook: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    base: horizonAssetToOutput(response.base),
    counter: horizonAssetToOutput(response.counter),
    bids: response.bids.map((b: any) => ({
      price: b.price,
      amount: b.amount,
      priceR: { n: Number(b.price_r.n), d: Number(b.price_r.d) },
    })),
    asks: response.asks.map((a: any) => ({
      price: a.price,
      amount: a.amount,
      priceR: { n: Number(a.price_r.n), d: Number(a.price_r.d) },
    })),
  };
}

/**
 * Fetch recent trades for a trading pair on the SDEX.
 *
 * @param baseAsset    - The base asset of the trading pair
 * @param counterAsset - The counter asset of the trading pair
 * @param config       - Network and optional Horizon URL
 * @param limit        - Maximum number of trades to return (default 10, max 50)
 * @param order        - Sort order: "desc" (newest first) or "asc" (oldest first)
 */
export async function getTrades(
  baseAsset: StellarAssetInput,
  counterAsset: StellarAssetInput,
  config: AssetClientConfig,
  limit: number = 10,
  order: "asc" | "desc" = "desc",
  _deps: AssetDeps = {}
): Promise<TradeRecord[]> {
  validateAssetInput(baseAsset);
  validateAssetInput(counterAsset);

  if (limit < 1 || limit > 50) {
    throw new Error("Trades limit must be between 1 and 50");
  }

  const server = _deps.createServer
    ? _deps.createServer(getHorizonUrl(config))
    : createServer(config);

  const base = assetInputToSdkAsset(baseAsset);
  const counter = assetInputToSdkAsset(counterAsset);

  let response;
  try {
    response = await server
      .trades()
      .forAssetPair(base, counter)
      .order(order)
      .limit(limit)
      .call();
  } catch (error: any) {
    throw new Error(
      `Failed to fetch trades: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return response.records.map((t: any) => ({
    id: t.id,
    pagingToken: t.paging_token,
    ledgerCloseTime: t.ledger_close_time,
    baseAccount: t.base_account,
    baseAmount: t.base_amount,
    baseAssetType: t.base_asset_type,
    baseAssetCode: t.base_asset_code,
    baseAssetIssuer: t.base_asset_issuer,
    counterAccount: t.counter_account,
    counterAmount: t.counter_amount,
    counterAssetType: t.counter_asset_type,
    counterAssetCode: t.counter_asset_code,
    counterAssetIssuer: t.counter_asset_issuer,
    price: { n: String(t.price.n), d: String(t.price.d) },
    baseIsSeller: t.base_is_seller,
  }));
}

// ─── Internal Utilities ─────────────────────────────────────────────────────

import { Asset } from "@stellar/stellar-sdk";

function assetInputToSdkAsset(asset: StellarAssetInput): Asset {
  if ("type" in asset) {
    return Asset.native();
  }
  return new Asset(asset.code, asset.issuer);
}

function horizonAssetToOutput(asset: any): {
  assetType: string;
  assetCode?: string;
  assetIssuer?: string;
} {
  if (asset.asset_type === "native") {
    return { assetType: "native" };
  }
  return {
    assetType: asset.asset_type,
    assetCode: asset.asset_code,
    assetIssuer: asset.asset_issuer,
  };
}
