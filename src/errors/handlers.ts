/**
 * Error handling utilities for Stellar AgentKit
 * 
 * Provides helpers for error handling, logging, and recovery.
 */

import { AgentKitError, isAgentKitError, ensureAgentKitError } from './index';

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  logError?: boolean;
  throwError?: boolean;
  returnErrorObject?: boolean;
}

/**
 * Generic error handler wrapper
 * Catches errors, ensures they're AgentKitError, logs them, and decides whether to rethrow
 */
export async function handleError<T>(
  fn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | AgentKitError> {
  const { logError = true, throwError = true, returnErrorObject = false } = options;

  try {
    return await fn();
  } catch (error) {
    const agentKitError = ensureAgentKitError(error);

    if (logError) {
      console.error(agentKitError.getFormattedMessage());
    }

    if (throwError) {
      throw agentKitError;
    }

    return returnErrorObject ? agentKitError : (undefined as any);
  }
}

/**
 * Synchronous error handler wrapper
 */
export function handleErrorSync<T>(
  fn: () => T,
  options: ErrorHandlerOptions = {}
): T | AgentKitError {
  try {
    return fn();
  } catch (error) {
    const agentKitError = ensureAgentKitError(error);

    if (options.logError) {
      console.error(agentKitError.getFormattedMessage());
    }

    if (options.throwError) {
      throw agentKitError;
    }

    return (options.returnErrorObject ? agentKitError : undefined) as any;
  }
}

/**
 * Result type for error handling without exceptions
 */
export type Result<T> = { success: true; data: T } | { success: false; error: AgentKitError };

/**
 * Execute function and return result (no exceptions thrown)
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: ensureAgentKitError(error) };
  }
}

/**
 * Execute function and return result (no exceptions thrown, synchronous)
 */
export function trySync<T>(fn: () => T): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: ensureAgentKitError(error) };
  }
}

/**
 * Error recovery helper - provides default value on error
 */
export async function recoverWith<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  shouldLog: boolean = true
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (shouldLog) {
      const agentKitError = ensureAgentKitError(error);
      console.warn(`Operation failed, returning default: ${agentKitError.message}`);
    }
    return defaultValue;
  }
}

/**
 * Chain multiple operations with error handling
 */
export async function chainOperations<T>(
  operations: Array<() => Promise<T>>,
  stopOnError: boolean = true
): Promise<{ results: (T | AgentKitError)[]; succeeded: number; failed: number }> {
  const results: (T | AgentKitError)[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const operation of operations) {
    try {
      const result = await operation();
      results.push(result);
      succeeded++;
    } catch (error) {
      const agentKitError = ensureAgentKitError(error);
      results.push(agentKitError);
      failed++;

      if (stopOnError) {
        break;
      }
    }
  }

  return { results, succeeded, failed };
}

/**
 * Determine if error is retriable
 */
export function isRetriable(error: unknown): boolean {
  if (!isAgentKitError(error)) return true; // Unknown errors might be retriable

  // These error codes are not retriable
  const nonRetriableCodes = [
    'VALIDATION_ERROR',
    'INVALID_ADDRESS_ERROR',
    'INVALID_AMOUNT_ERROR',
    'MISSING_PARAMETER_ERROR',
    'OPERATION_NOT_ALLOWED',
  ];

  return !nonRetriableCodes.includes(error.code);
}

/**
 * Retry with exponential backoff
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    shouldRetry = isRetriable,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
        throw ensureAgentKitError(lastError);
      }

      console.warn(
        `Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms: ${lastError.message}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw ensureAgentKitError(lastError);
}
