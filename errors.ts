/**
 * AgentKit error codes for structured error handling.
 * Use these with {@link AgentKitError} to get predictable `code` and `context` for debugging.
 */
export type AgentKitErrorCode =
  | "invalid_address"
  | "insufficient_balance"
  | "missing_trustline"
  | "slippage_too_high"
  | "network_blocked"
  | "simulation_failed"
  | "transaction_failed"
  | "invalid_params"
  | "invalid_decimals"
  | "invalid_supply"
  | "trustline_failed"
  | "mint_failed"
  | "validation"
  | "unknown";

/**
 * Context attached to AgentKitError for debugging (asset, amount, network, operation, etc.).
 */
export interface AgentKitErrorContext {
  operation?: string;
  asset?: string;
  amount?: string;
  network?: string;
  address?: string;
  to?: string;
  buyA?: boolean;
  out?: string;
  inMax?: string;
  toAddress?: string;
  hash?: string;
  [key: string]: unknown;
}

/**
 * Structured error type for Stellar AgentKit.
 * Public methods (swap, bridge, lp.*) throw this (or subclasses) with a stable `code` and optional `context`.
 *
 * @example
 * try {
 *   await agent.swap({ to: "G...", buyA: true, out: "100", inMax: "110" });
 * } catch (err) {
 *   if (err instanceof AgentKitError) {
 *     if (err.code === "invalid_address") console.log("Bad address:", err.context?.address);
 *     if (err.code === "slippage_too_high") console.log("Slippage:", err.context);
 *   }
 *   throw err;
 * }
 */
export class AgentKitError extends Error {
  readonly code: AgentKitErrorCode;
  readonly context?: AgentKitErrorContext;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: AgentKitErrorCode,
    options?: {
      context?: AgentKitErrorContext;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "AgentKitError";
    this.code = code;
    this.context = options?.context;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, AgentKitError.prototype);
  }
}

/**
 * Ensures an unknown thrown value is an AgentKitError; if not, wraps it with code "unknown".
 */
export function ensureAgentKitError(
  error: unknown,
  fallbackContext?: AgentKitErrorContext,
): AgentKitError {
  if (error instanceof AgentKitError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AgentKitError(message, "unknown", {
    context: fallbackContext,
    cause: error,
  });
}

/**
 * Type guard to check if an error is an AgentKitError.
 */
export function isAgentKitError(error: unknown): error is AgentKitError {
  return error instanceof AgentKitError;
}
