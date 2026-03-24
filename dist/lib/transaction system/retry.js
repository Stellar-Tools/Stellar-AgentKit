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
exports.withRetry = exports.delay = exports.classifyError = void 0;
const types_1 = require("./types");
const classifyError = (error) => {
    const errMsg = (error === null || error === void 0 ? void 0 : error.message) || String(error);
    const transientKeywords = [
        "timeout", "network", "tx_bad_seq", "rate limit", "pending", "econnreset", "fetch"
    ];
    const permanentKeywords = [
        "insufficient funds", "tx_bad_auth", "op_underfunded", "invalid signature", "tx_failed"
    ];
    const lowerMsg = errMsg.toLowerCase();
    for (const keyword of permanentKeywords) {
        if (lowerMsg.includes(keyword))
            return types_1.ErrorType.PERMANENT;
    }
    for (const keyword of transientKeywords) {
        if (lowerMsg.includes(keyword))
            return types_1.ErrorType.TRANSIENT;
    }
    return types_1.ErrorType.UNKNOWN;
};
exports.classifyError = classifyError;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.delay = delay;
const withRetry = (operation_1, ...args_1) => __awaiter(void 0, [operation_1, ...args_1], void 0, function* (operation, maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000) {
    let attempt = 0;
    while (true) {
        try {
            return yield operation();
        }
        catch (err) {
            attempt++;
            const errorType = (0, exports.classifyError)(err);
            if (errorType === types_1.ErrorType.PERMANENT) {
                console.error(`[Antigravity] Permanent error detected. Aborting retries.`);
                throw new types_1.AntigravityError(err.message, errorType, err);
            }
            if (attempt > maxRetries) {
                console.error(`[Antigravity] Max retries reached (${maxRetries}).`);
                throw new types_1.AntigravityError(`Max retries reached: ${err.message}`, errorType, err);
            }
            // Exponential backoff with jitter
            const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * (backoff * 0.1));
            const sleepTime = backoff + jitter;
            console.warn(`[Antigravity] Execution failed (${err.message}). Retrying in ${sleepTime}ms (Attempt ${attempt}/${maxRetries})...`);
            yield (0, exports.delay)(sleepTime);
        }
    }
});
exports.withRetry = withRetry;
