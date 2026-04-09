import Big from "big.js";
import {
  Asset,
  Horizon,
  Networks,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getSigningKeypair, signTransaction } from "./stellar";
import { buildPathPaymentTransaction } from "../utils/buildTransaction";

export type StellarAssetInput =
  | { type: "native" }
  | { code: string; issuer: string };

export type RouteMode = "strict-send" | "strict-receive";

export interface QuoteSwapParams {
  mode: RouteMode;
  sendAsset: StellarAssetInput;
  destAsset: StellarAssetInput;
  sendAmount?: string;
  destAmount?: string;
  destination?: string;
  limit?: number;
}

export interface SwapBestRouteParams extends QuoteSwapParams {
  slippageBps?: number;
}

export interface HorizonPathRecord {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: HorizonAssetRecord[];
}

export interface RouteQuote {
  path: StellarAssetInput[];
  sendAmount: string;
  destAmount: string;
  estimatedPrice: string;
  hopCount: number;
  raw: HorizonPathRecord;
}

export interface SwapBestRouteResult {
  hash: string;
  mode: RouteMode;
  sendAmount: string;
  destAmount: string;
  path: StellarAssetInput[];
}

export interface DexClientConfig {
  network: "testnet" | "mainnet";
  horizonUrl: string;
  publicKey: string;
}

interface HorizonPathResponse {
  _embedded?: {
    records?: HorizonPathRecord[];
  };
}

interface HorizonAccountResponse {
  balances?: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

interface HorizonAssetRecord {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface DexDependencies {
  fetchImpl?: typeof fetch;
  createServer?: (horizonUrl: string) => {
    loadAccount: (publicKey: string) => Promise<any>;
    submitTransaction: (transaction: any) => Promise<{ hash: string }>;
  };
}

const STELLAR_AMOUNT_DECIMALS = 7;
const DEFAULT_LIMIT = 5;
const DEFAULT_SLIPPAGE_BPS = 100;
const INTERNAL_FETCH_LIMIT = 20;

export function assetInputToSdkAsset(asset: StellarAssetInput): Asset {
  if ("type" in asset) {
    return Asset.native();
  }

  if (!asset.code || !asset.issuer) {
    throw new Error("Issued assets require both code and issuer");
  }

  if (!StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error(`Invalid issuer public key: ${asset.issuer}`);
  }

  return new Asset(asset.code, asset.issuer);
}

export function assetInputToHorizonAsset(asset: StellarAssetInput): string {
  return "type" in asset ? "native" : `${asset.code}:${asset.issuer}`;
}

export function normalizePathRecord(record: HorizonPathRecord): RouteQuote {
  const path = record.path.map(horizonAssetToInput);
  const estimatedPrice = formatStellarAmount(
    new Big(record.destination_amount).div(record.source_amount)
  );

  return {
    path,
    sendAmount: record.source_amount,
    destAmount: record.destination_amount,
    estimatedPrice,
    hopCount: path.length,
    raw: record,
  };
}

export function rankRouteQuotes(quotes: RouteQuote[], mode: RouteMode): RouteQuote[] {
  return [...quotes].sort((left, right) => {
    const amountComparison =
      mode === "strict-send"
        ? compareAmounts(right.destAmount, left.destAmount)
        : compareAmounts(left.sendAmount, right.sendAmount);

    if (amountComparison !== 0) {
      return amountComparison;
    }

    if (left.hopCount !== right.hopCount) {
      return left.hopCount - right.hopCount;
    }

    return 0;
  });
}

export function calculateSwapBounds(
  quote: RouteQuote,
  mode: RouteMode,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): { sendMax?: string; destMin?: string } {
  if (!Number.isInteger(slippageBps) || slippageBps < 0) {
    throw new Error("slippageBps must be a non-negative integer");
  }

  const slippage = new Big(slippageBps).div(10000);

  if (mode === "strict-send") {
    return {
      destMin: formatStellarAmount(new Big(quote.destAmount).mul(new Big(1).minus(slippage))),
    };
  }

  return {
    sendMax: formatStellarAmount(new Big(quote.sendAmount).mul(new Big(1).plus(slippage))),
  };
}

export async function quoteSwap(
  client: DexClientConfig,
  params: QuoteSwapParams,
  deps: DexDependencies = {}
): Promise<RouteQuote[]> {
  validateDexClient(client);
  validateQuoteParams(params);
  validateQuoteLimit(params.limit);

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("Global fetch is not available in this environment");
  }

  const destination = params.destination ?? client.publicKey;
  validatePublicKey(destination, "destination");
  await validateDestinationAssetSupport(client, destination, params.destAsset, fetchImpl);

  const response = await fetchImpl(buildPathEndpointUrl(client, params));

  if (!response.ok) {
    throw new Error(`Failed to fetch path quotes: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as HorizonPathResponse;
  const records = payload._embedded?.records ?? [];
  const normalizedQuotes = records.map(normalizePathRecord);

  return rankRouteQuotes(normalizedQuotes, params.mode).slice(0, params.limit ?? DEFAULT_LIMIT);
}

export async function swapBestRoute(
  client: DexClientConfig,
  params: SwapBestRouteParams,
  deps: DexDependencies = {}
): Promise<SwapBestRouteResult> {
  validateDexClient(client);
  validateQuoteParams(params);
  validateQuoteLimit(params.limit);

  getSigningKeypair(client.publicKey);

  const destination = params.destination ?? client.publicKey;
  validatePublicKey(destination, "destination");

  const quotes = await quoteSwap(client, params, deps);
  const bestQuote = quotes[0];

  if (!bestQuote) {
    throw new Error("No route available for the requested swap");
  }

  const createServer =
    deps.createServer ?? ((horizonUrl: string) => new Horizon.Server(horizonUrl));
  const server = createServer(client.horizonUrl);
  const sourceAccount = await server.loadAccount(client.publicKey);
  const path = bestQuote.path.map(assetInputToSdkAsset);
  const { sendMax, destMin } = calculateSwapBounds(
    bestQuote,
    params.mode,
    params.slippageBps ?? DEFAULT_SLIPPAGE_BPS
  );

  const transaction = buildPathPaymentTransaction(sourceAccount, {
    mode: params.mode,
    sendAsset: assetInputToSdkAsset(params.sendAsset),
    destAsset: assetInputToSdkAsset(params.destAsset),
    sendAmount: params.mode === "strict-send" ? params.sendAmount! : bestQuote.sendAmount,
    destAmount: params.mode === "strict-receive" ? params.destAmount! : bestQuote.destAmount,
    destination,
    path,
    sendMax,
    destMin,
  }, {
    networkPassphrase: getNetworkPassphrase(client.network),
  });

  const signedXdr = signTransaction(
    transaction.toXDR(),
    getNetworkPassphrase(client.network),
    client.publicKey
  );
  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    getNetworkPassphrase(client.network)
  );
  const submission = await server.submitTransaction(signedTransaction);

  return {
    hash: submission.hash,
    mode: params.mode,
    sendAmount: params.mode === "strict-send" ? params.sendAmount! : bestQuote.sendAmount,
    destAmount: params.mode === "strict-receive" ? params.destAmount! : bestQuote.destAmount,
    path: bestQuote.path,
  };
}

function buildPathEndpointUrl(
  client: DexClientConfig,
  params: QuoteSwapParams
): string {
  const url = new URL(
    params.mode === "strict-send" ? "/paths/strict-send" : "/paths/strict-receive",
    withTrailingSlash(client.horizonUrl)
  );
  const searchParams = url.searchParams;

  searchParams.set("limit", String(INTERNAL_FETCH_LIMIT));

  if (params.mode === "strict-send") {
    applyAssetParams(searchParams, "source_asset", params.sendAsset);
    searchParams.set("source_amount", params.sendAmount!);
    searchParams.set("destination_assets", assetInputToHorizonAsset(params.destAsset));
  } else {
    applyAssetParams(searchParams, "destination_asset", params.destAsset);
    searchParams.set("destination_amount", params.destAmount!);
    searchParams.set("source_account", client.publicKey);
  }

  return url.toString();
}

function applyAssetParams(
  searchParams: URLSearchParams,
  prefix: "source_asset" | "destination_asset",
  asset: StellarAssetInput
) {
  if ("type" in asset) {
    searchParams.set(`${prefix}_type`, "native");
    return;
  }

  searchParams.set(`${prefix}_type`, "credit_alphanum4");
  if (asset.code.length > 4) {
    searchParams.set(`${prefix}_type`, "credit_alphanum12");
  }
  searchParams.set(`${prefix}_code`, asset.code);
  searchParams.set(`${prefix}_issuer`, asset.issuer);
}

function horizonAssetToInput(asset: HorizonAssetRecord): StellarAssetInput {
  if (asset.asset_type === "native") {
    return { type: "native" };
  }

  if (!asset.asset_code || !asset.asset_issuer) {
    throw new Error("Horizon asset record is missing code or issuer");
  }

  return {
    code: asset.asset_code,
    issuer: asset.asset_issuer,
  };
}

function validateDexClient(client: DexClientConfig) {
  validatePublicKey(client.publicKey, "publicKey");
}

function validateQuoteParams(params: QuoteSwapParams) {
  if (params.mode === "strict-send") {
    if (!params.sendAmount) {
      throw new Error("sendAmount is required for strict-send quotes");
    }
  } else if (!params.destAmount) {
    throw new Error("destAmount is required for strict-receive quotes");
  }

  assetInputToSdkAsset(params.sendAsset);
  assetInputToSdkAsset(params.destAsset);
}

function validateQuoteLimit(limit?: number) {
  if (limit === undefined) {
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > INTERNAL_FETCH_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${INTERNAL_FETCH_LIMIT}`);
  }
}

function validatePublicKey(value: string, label: string) {
  if (!value || !StrKey.isValidEd25519PublicKey(value)) {
    throw new Error(`Invalid ${label} Stellar public key`);
  }
}

function getNetworkPassphrase(network: DexClientConfig["network"]): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function compareAmounts(left: string, right: string): number {
  return new Big(left).cmp(new Big(right));
}

function formatStellarAmount(value: Big): string {
  return trimTrailingZeros(value.round(STELLAR_AMOUNT_DECIMALS, 0).toFixed(STELLAR_AMOUNT_DECIMALS));
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) {
    return value;
  }

  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function validateDestinationAssetSupport(
  client: DexClientConfig,
  destination: string,
  destAsset: StellarAssetInput,
  fetchImpl: typeof fetch
) {
  if ("type" in destAsset) {
    return;
  }

  const response = await fetchImpl(
    new URL(`/accounts/${destination}`, withTrailingSlash(client.horizonUrl)).toString()
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load destination account for asset support validation: ${response.status} ${response.statusText}`
    );
  }

  const account = (await response.json()) as HorizonAccountResponse;
  const supportsAsset = (account.balances ?? []).some((balance) => {
    return (
      balance.asset_type !== "native" &&
      balance.asset_code === destAsset.code &&
      balance.asset_issuer === destAsset.issuer
    );
  });

  if (!supportsAsset) {
    throw new Error(
      "Destination account does not trust the requested destination asset"
    );
  }
}
