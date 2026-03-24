import { ErrorType, AntigravityError } from "./types";

export const classifyError = (error: any): ErrorType => {
    const errMsg = error?.message || String(error);
    const transientKeywords = [
        "timeout", "network", "tx_bad_seq", "rate limit", "pending", "econnreset", "fetch"
    ];
    const permanentKeywords = [
        "insufficient funds", "tx_bad_auth", "op_underfunded", "invalid signature", "tx_failed"
    ];

    const lowerMsg = errMsg.toLowerCase();

    for (const keyword of permanentKeywords) {
        if (lowerMsg.includes(keyword)) return ErrorType.PERMANENT;
    }

    for (const keyword of transientKeywords) {
        if (lowerMsg.includes(keyword)) return ErrorType.TRANSIENT;
    }

    return ErrorType.UNKNOWN;
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000
): Promise<T> => {
    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (err: any) {
            attempt++;
            const errorType = classifyError(err);

            if (errorType === ErrorType.PERMANENT) {
                console.error(`[Antigravity] Permanent error detected. Aborting retries.`);
                throw new AntigravityError(err.message, errorType, err);
            }

            if (attempt > maxRetries) {
                console.error(`[Antigravity] Max retries reached (${maxRetries}).`);
                throw new AntigravityError(`Max retries reached: ${err.message}`, errorType, err);
            }

            // Exponential backoff with jitter
            const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * (backoff * 0.1));
            const sleepTime = backoff + jitter;

            console.warn(`[Antigravity] Execution failed (${err.message}). Retrying in ${sleepTime}ms (Attempt ${attempt}/${maxRetries})...`);
            await delay(sleepTime);
        }
    }
};
