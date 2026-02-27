/**
 * Utility for retrying an async operation with exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    retryableErrors?: RegExp[];
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    factor = 2,
    retryableErrors = [
      /timeout/i,
      /rate limit/i,
      /network/i,
      /connection/i,
      /socket/i,
      /overloaded/i,
      /429/,
      /502/,
      /503/,
      /504/
    ],
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      
      const isRetryable = retryableErrors.some((re) => re.test(message));
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      console.warn(`Attempt ${attempt + 1} failed: ${message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      delay = Math.min(delay * factor, maxDelayMs);
    }
  }

  throw lastError;
}
