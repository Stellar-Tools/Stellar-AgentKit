/**
 * AgentKit error types and helpers.
 */
export const AgentKitErrorCode = {
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  MISSING_TRUSTLINE: "MISSING_TRUSTLINE",
  SLIPPAGE_TOO_HIGH: "SLIPPAGE_TOO_HIGH",
  SIMULATION_FAILED: "SIMULATION_FAILED",
  VALIDATION: "VALIDATION",
  NETWORK_BLOCKED: "NETWORK_BLOCKED",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
} as const;

export type AgentKitErrorCodeType = (typeof AgentKitErrorCode)[keyof typeof AgentKitErrorCode];

export interface AgentKitErrorContext {
  to?: string;
  network?: string;
  amount?: string;
  [key: string]: unknown;
}

export class AgentKitError extends Error {
  constructor(
    public readonly code: AgentKitErrorCodeType,
    message: string,
    public readonly context?: AgentKitErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "AgentKitError";
    Object.setPrototypeOf(this, AgentKitError.prototype);
  }
}

export function isAgentKitError(e: unknown): e is AgentKitError {
  return e instanceof AgentKitError;
}

/**
 * Map simulation error messages to error codes.
 */
export function classifySimulationError(message: string): AgentKitErrorCodeType {
  const lower = message.toLowerCase();
  if (lower.includes("insufficient balance")) return AgentKitErrorCode.INSUFFICIENT_BALANCE;
  if (lower.includes("trustline") && (lower.includes("required") || lower.includes("missing")))
    return AgentKitErrorCode.MISSING_TRUSTLINE;
  if (lower.includes("slippage")) return AgentKitErrorCode.SLIPPAGE_TOO_HIGH;
  return AgentKitErrorCode.SIMULATION_FAILED;
}

export const classifySimulationMessage = classifySimulationError;
