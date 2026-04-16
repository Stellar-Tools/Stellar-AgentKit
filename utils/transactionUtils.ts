import * as StellarSdk from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet" | "mainnet";

export function buildHorizonServer(
  network: StellarNetwork
): StellarSdk.Horizon.Server {
  const url =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  return new StellarSdk.Horizon.Server(url);
}

export function buildSorobanServer(rpcUrl: string) {
  return new StellarSdk.rpc.Server(rpcUrl);
}

export function getNetworkPassphrase(network: StellarNetwork): string {
  return network === "mainnet"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;
}

export interface FeeEstimate {
  baseFeeStroops: string;
  totalFeeStroops: string;
  totalFeeXLM: string;
  operationCount: number;
  networkCongestionLevel: "low" | "medium" | "high";
  recommendedFeeStroops: string;
}

export async function estimateFee(
  network: StellarNetwork,
  operationCount = 1
): Promise<FeeEstimate> {
  const server = buildHorizonServer(network);

  let feeStats: any;

  try {
    feeStats = await server.feeStats();
  } catch {
    // fallback
    const baseFee = parseInt(StellarSdk.BASE_FEE);
    const total = baseFee * operationCount;

    return {
      baseFeeStroops: String(baseFee),
      totalFeeStroops: String(total),
      totalFeeXLM: (total / 10_000_000).toFixed(7),
      operationCount,
      networkCongestionLevel: "low",
      recommendedFeeStroops: String(baseFee),
    };
  }

  const p50Fee = parseInt(feeStats.fee_charged.p50 ?? StellarSdk.BASE_FEE);
  const p90Fee = parseInt(feeStats.fee_charged.p90 ?? StellarSdk.BASE_FEE);
  const p99Fee = parseInt(feeStats.fee_charged.p99 ?? StellarSdk.BASE_FEE);

  let congestionLevel: "low" | "medium" | "high";
  let recommendedFee: number;

  const ratio = p90Fee / Math.max(p50Fee, 1);

  if (ratio < 1.5) {
    congestionLevel = "low";
    recommendedFee = p50Fee * operationCount;
  } else if (ratio < 3) {
    congestionLevel = "medium";
    recommendedFee = p90Fee * operationCount;
  } else {
    congestionLevel = "high";
    recommendedFee = p99Fee * operationCount;
  }

  const totalFee = recommendedFee;

  return {
    baseFeeStroops: String(p50Fee),
    totalFeeStroops: String(totalFee),
    totalFeeXLM: (totalFee / 10_000_000).toFixed(7),
    operationCount,
    networkCongestionLevel: congestionLevel,
    recommendedFeeStroops: String(
      Math.ceil(recommendedFee / operationCount)
    ),
  };
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRYABLE_ERRORS = [
  "timeout",
  "ECONNRESET",
  "ENOTFOUND",
  "503",
  "429",
  "network",
  "rate limit",
];

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      const message =
        err instanceof Error
          ? err.message.toLowerCase()
          : String(err).toLowerCase();

      const isRetryable = retryableErrors.some((pattern) =>
        message.includes(pattern.toLowerCase())
      );

      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200,
        maxDelayMs
      );

      console.warn(
        `[StellarAgentKit] Attempt ${attempt}/${maxAttempts} failed: ${message}. Retrying in ${Math.round(delay)}ms...`
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

export interface StellarErrorInfo {
  code: string;
  humanMessage: string;
  isFatal: boolean;
  suggestion: string;
}

export function classifyStellarError(error: string): StellarErrorInfo {
  const e = error.toLowerCase();

  const knownErrors: Array<[string, StellarErrorInfo]> = [
    [
      "tx_bad_seq",
      {
        code: "tx_bad_seq",
        humanMessage: "Transaction sequence number mismatch.",
        isFatal: false,
        suggestion:
          "sequence number is invalid. reload the account and rebuild the transaction.",
      },
    ],
    [
      "tx_bad_auth",
      {
        code: "tx_bad_auth",
        humanMessage: "Invalid signature or insufficient signers.",
        isFatal: true,
        suggestion: "Verify the secret key matches the source account.",
      },
    ],
    [
      "op_underfunded",
      {
        code: "op_underfunded",
        humanMessage: "Insufficient balance to complete the operation.",
        isFatal: false,
        suggestion:
          "Check the account balance and ensure minimum reserve is maintained.",
      },
    ],
    [
      "op_no_destination",
      {
        code: "op_no_destination",
        humanMessage: "Destination account does not exist.",
        isFatal: true,
        suggestion:
          "Create the destination account first using createAccount operation.",
      },
    ],
    [
      "op_no_trust",
      {
        code: "op_no_trust",
        humanMessage:
          "Destination account has no trustline for this asset.",
        isFatal: true,
        suggestion:
          "Ask the destination to create a trustline for this asset first.",
      },
    ],
    [
      "op_too_few_offers",
      {
        code: "op_too_few_offers",
        humanMessage: "Insufficient liquidity for this path payment.",
        isFatal: false,
        suggestion:
          "Try a smaller amount, wider slippage tolerance, or a different asset pair.",
      },
    ],
    [
      "op_line_full",
      {
        code: "op_line_full",
        humanMessage: "Destination trustline is full (at limit).",
        isFatal: true,
        suggestion: "Destination must increase their trustline limit.",
      },
    ],
    [
      "insufficient reserve",
      {
        code: "insufficient_reserve",
        humanMessage:
          "Transaction would drop account below minimum XLM reserve.",
        isFatal: false,
        suggestion:
          "Stellar requires 1 XLM base reserve + 0.5 XLM per trustline/offer.",
      },
    ],
    [
      "rate limit",
      {
        code: "rate_limited",
        humanMessage: "Horizon rate limit exceeded.",
        isFatal: false,
        suggestion:
          "Wait a moment and retry. Consider using a dedicated Horizon instance.",
      },
    ],
  ];

  for (const [pattern, info] of knownErrors) {
    if (e.includes(pattern)) {
      return info;
    }
  }

  return {
    code: "unknown_error",
    humanMessage: error,
    isFatal: false,
    suggestion:
      "Check Stellar documentation or Horizon response for details.",
  };
}