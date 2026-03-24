/**
 * Custom Error Classes for Stellar AgentKit
 * 
 * Provides structured error handling with context and recovery suggestions.
 * All errors extend AgentKitError for consistent error handling across the SDK.
 */

/**
 * Base error class for all Stellar AgentKit errors
 */
export class AgentKitError extends Error {
  public readonly code: string;
  public readonly context: Record<string, any>;
  public readonly suggestion?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.suggestion = suggestion;
    this.cause = cause;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AgentKitError.prototype);
  }

  /**
   * Get human-readable error message with context and suggestion
   * Safely handles non-serializable values like BigInt at any nesting level
   */
  getFormattedMessage(): string {
    let output = `${this.name} [${this.code}]\n${this.message}`;

    if (Object.keys(this.context).length > 0) {
      try {
        output += `\n\nContext:\n${Object.entries(this.context)
          .map(([k, v]) => {
            // Handle BigInt and other non-serializable types
            if (typeof v === 'bigint') {
              return `  ${k}: ${v.toString()}n`;
            }
            if (v === undefined) {
              return `  ${k}: undefined`;
            }
            if (v === null) {
              return `  ${k}: null`;
            }
            try {
              // Replacer function handles BigInt at all nesting levels
              return `  ${k}: ${JSON.stringify(v, (_key, value) => {
                if (typeof value === 'bigint') {
                  return `${value.toString()}n`;
                }
                return value;
              })}`;
            } catch {
              return `  ${k}: [Unserializable: ${typeof v}]`;
            }
          })
          .join('\n')}`;
      } catch (e) {
        output += `\n\nContext: [Failed to serialize context - ${String(e)}]`;
      }
    }

    if (this.suggestion) {
      output += `\n\nSuggestion: ${this.suggestion}`;
    }

    return output;
  }
}

/**
 * Thrown when input validation fails
 */
export class ValidationError extends AgentKitError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      context,
      suggestion || 'Please check your input parameters and try again.',
      cause
    );
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when a Stellar address is invalid
 */
export class InvalidAddressError extends ValidationError {
  constructor(
    address: string,
    context: Record<string, any> = {}
  ) {
    const fullContext = { address, ...context };
    super(
      `Invalid Stellar address: "${address.slice(0, 10)}..."`,
      fullContext,
      `Ensure the address is a valid Stellar public key (starts with 'G' or 'C' and is 56 characters).`
    );
    Object.setPrototypeOf(this, InvalidAddressError.prototype);
  }
}

/**
 * Thrown when an amount value is invalid
 */
export class InvalidAmountError extends ValidationError {
  constructor(
    amount: string | number,
    context: Record<string, any> = {}
  ) {
    const fullContext = { amount: String(amount), ...context };
    super(
      `Invalid amount: "${amount}"`,
      fullContext,
      `Amount must be a positive number. Use string format for large numbers: "1000.50"`
    );
    Object.setPrototypeOf(this, InvalidAmountError.prototype);
  }
}

/**
 * Thrown when network configuration is invalid
 */
export class InvalidNetworkError extends ValidationError {
  constructor(
    network: string,
    context: Record<string, any> = {}
  ) {
    const fullContext = { network, ...context };
    super(
      `Invalid network: "${network}"`,
      fullContext,
      `Use one of: "testnet" | "mainnet"`
    );
    Object.setPrototypeOf(this, InvalidNetworkError.prototype);
  }
}

/**
 * Thrown when a required parameter is missing
 */
export class MissingParameterError extends ValidationError {
  constructor(
    paramName: string,
    operation: string,
    context: Record<string, any> = {}
  ) {
    const fullContext = { parameter: paramName, operation, ...context };
    super(
      `Missing required parameter: "${paramName}" in ${operation}`,
      fullContext,
      `Check the operation documentation and provide the required "${paramName}" parameter.`
    );
    Object.setPrototypeOf(this, MissingParameterError.prototype);
  }
}

/**
 * Thrown when a transaction operation fails
 */
export class TransactionError extends AgentKitError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(
      message,
      'TRANSACTION_ERROR',
      context,
      suggestion || 'Check transaction parameters and retry.',
      cause
    );
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

/**
 * Thrown when transaction simulation fails
 */
export class SimulationError extends TransactionError {
  constructor(
    functionName: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      `Transaction simulation failed for function: ${functionName}`,
      { functionName, ...context },
      `Verify contract address, function parameters, and network connectivity.`,
      cause
    );
    Object.setPrototypeOf(this, SimulationError.prototype);
  }
}

/**
 * Thrown when transaction submission fails
 */
export class SubmissionError extends TransactionError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(
      message,
      context,
      suggestion || 'Check your account balance and retry.',
      cause
    );
    Object.setPrototypeOf(this, SubmissionError.prototype);
  }
}

/**
 * Thrown when network communication fails
 */
export class NetworkError extends AgentKitError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(
      message,
      'NETWORK_ERROR',
      context,
      suggestion || 'Check your internet connection and try again.',
      cause
    );
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Thrown when contract operation fails
 */
export class ContractError extends AgentKitError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestion?: string,
    cause?: Error
  ) {
    super(
      message,
      'CONTRACT_ERROR',
      context,
      suggestion || 'Check contract documentation and parameters.',
      cause
    );
    Object.setPrototypeOf(this, ContractError.prototype);
  }
}

/**
 * Thrown when operation is not allowed in current context
 */
export class OperationNotAllowedError extends AgentKitError {
  constructor(
    operation: string,
    reason: string,
    context: Record<string, any> = {},
    suggestion?: string
  ) {
    const fullContext = { operation, reason, ...context };
    super(
      `Operation not allowed: ${operation} - ${reason}`,
      'OPERATION_NOT_ALLOWED',
      fullContext,
      suggestion
    );
    Object.setPrototypeOf(this, OperationNotAllowedError.prototype);
  }
}

/**
 * Type guard to check if error is an AgentKitError
 */
export function isAgentKitError(error: unknown): error is AgentKitError {
  return error instanceof AgentKitError;
}

/**
 * Unwrap or wrap an error as AgentKitError
 */
export function ensureAgentKitError(
  error: unknown,
  defaultCode: string = 'UNKNOWN_ERROR'
): AgentKitError {
  if (isAgentKitError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AgentKitError(message, defaultCode, {}, undefined, error instanceof Error ? error : undefined);
}
