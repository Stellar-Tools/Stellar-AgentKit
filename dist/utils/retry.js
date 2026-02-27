"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
/**
 * Utility for retrying an async operation with exponential backoff.
 */
function withRetry(operation_1) {
    return __awaiter(this, arguments, void 0, function* (operation, options = {}) {
        const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000, factor = 2, retryableErrors = [
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
        ], } = options;
        let lastError;
        let delay = initialDelayMs;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return yield operation();
            }
            catch (error) {
                lastError = error;
                const message = error instanceof Error ? error.message : String(error);
                const isRetryable = retryableErrors.some((re) => re.test(message));
                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }
                console.warn(`Attempt ${attempt + 1} failed: ${message}. Retrying in ${delay}ms...`);
                yield new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * factor, maxDelayMs);
            }
        }
        throw lastError;
    });
}
