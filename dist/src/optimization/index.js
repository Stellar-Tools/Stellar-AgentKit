"use strict";
/**
 * Performance Optimization Layer for Stellar AgentKit
 *
 * Provides caching, memoization, and optimization strategies
 * for frequently called Soroban operations.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationProfiler = exports.OperationProfiler = exports.priceCalculator = exports.PriceCalculator = exports.sorobanCaches = exports.SorobanCaches = exports.TTLCache = void 0;
exports.memoizeAsync = memoizeAsync;
const big_js_1 = __importDefault(require("big.js"));
/**
 * Generic cache with TTL support
 */
class TTLCache {
    constructor(defaultTtlMs = 5 * 60 * 1000) {
        this.cache = new Map();
        this.cleanupInterval = null;
        this.defaultTtl = defaultTtlMs;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttlMs) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value, ttlMs) {
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttlMs: ttlMs || this.defaultTtl,
        });
    }
    /**
     * Check if key exists and is valid
     */
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Delete key
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear all entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Cleanup expired entries
     */
    cleanup() {
        const before = this.cache.size;
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttlMs) {
                this.cache.delete(key);
            }
        }
        return before - this.cache.size;
    }
    /**
     * Start automatic cleanup
     */
    startAutoCleanup(intervalMs = 60000) {
        if (this.cleanupInterval)
            return;
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, intervalMs);
    }
    /**
     * Stop automatic cleanup
     */
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
exports.TTLCache = TTLCache;
/**
 * Memoization wrapper for async functions
 */
function memoizeAsync(fn, ttlMs = 5 * 60 * 1000, keyGenerator) {
    const cache = new TTLCache(ttlMs);
    return async (...args) => {
        const key = (keyGenerator ? keyGenerator(...args) : JSON.stringify(args));
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const result = await fn(...args);
        cache.set(key, result);
        return result;
    };
}
/**
 * Soroban operation caches
 */
class SorobanCaches {
    constructor() {
        // Pool reserves cache: contractId -> [reserves]
        this.poolResources = new TTLCache(10 * 60 * 1000);
        // Share ID cache: contractId -> shareId
        this.shareIds = new TTLCache(10 * 60 * 1000);
        // Account info cache: address -> sequence
        this.accountSequences = new TTLCache(2 * 60 * 1000);
        // Network state cache
        this.networkState = new TTLCache(1 * 60 * 1000);
        // Swap quotes cache: "from:amount" -> expected output
        this.swapQuotes = new TTLCache(30 * 1000); // 30 second quotes
        // Auto-cleanup every 5 minutes
        this.poolResources.startAutoCleanup();
        this.shareIds.startAutoCleanup();
        this.accountSequences.startAutoCleanup();
        this.networkState.startAutoCleanup();
        this.swapQuotes.startAutoCleanup();
    }
    /**
     * Clear all caches
     */
    clearAll() {
        this.poolResources.clear();
        this.shareIds.clear();
        this.accountSequences.clear();
        this.networkState.clear();
        this.swapQuotes.clear();
    }
    /**
     * Stop all background cleanup timers.
     * Useful for tests and process shutdown to avoid leaking intervals.
     */
    stopAutoCleanup() {
        this.poolResources.stopAutoCleanup();
        this.shareIds.stopAutoCleanup();
        this.accountSequences.stopAutoCleanup();
        this.networkState.stopAutoCleanup();
        this.swapQuotes.stopAutoCleanup();
    }
    /**
     * Get cache stats
     */
    getStats() {
        return {
            poolResources: this.poolResources.size(),
            shareIds: this.shareIds.size(),
            accountSequences: this.accountSequences.size(),
            networkState: this.networkState.size(),
            swapQuotes: this.swapQuotes.size(),
            total: this.poolResources.size() +
                this.shareIds.size() +
                this.accountSequences.size() +
                this.networkState.size() +
                this.swapQuotes.size(),
        };
    }
}
exports.SorobanCaches = SorobanCaches;
exports.sorobanCaches = new SorobanCaches();
/**
 * Price calculation cache and helpers
 */
class PriceCalculator {
    constructor() {
        this.exchangeRates = new TTLCache(5 * 60 * 1000);
    }
    /**
     * Calculate expected output for swap
     *
     * Uses constant product formula: x * y = k
     * With 0.3% swap fee
     */
    calculateSwapOutput(inputAmount, reserveIn, reserveOut, feePercent = 0.003) {
        const input = new big_js_1.default(inputAmount);
        const reserveInBig = new big_js_1.default(reserveIn);
        const reserveOutBig = new big_js_1.default(reserveOut);
        const fee = new big_js_1.default(1).minus(feePercent);
        // (input * fee) * reserveOut / (reserveIn + input * fee)
        const amountInWithFee = input.times(fee);
        const numerator = amountInWithFee.times(reserveOutBig);
        const denominator = reserveInBig.plus(amountInWithFee);
        if (denominator.lte(0)) {
            throw new Error("Invalid swap parameters: denominator must be greater than zero");
        }
        return numerator.div(denominator).toString();
    }
    /**
     * Calculate expected input needed for desired output
     */
    calculateSwapInput(outputAmount, reserveIn, reserveOut, feePercent = 0.003) {
        const output = new big_js_1.default(outputAmount);
        const reserveInBig = new big_js_1.default(reserveIn);
        const reserveOutBig = new big_js_1.default(reserveOut);
        const fee = new big_js_1.default(1).minus(feePercent);
        // (reserveIn * output) / ((reserveOut - output) * fee)
        const numerator = reserveInBig.times(output);
        const denominator = reserveOutBig.minus(output).times(fee);
        if (denominator.lte(0)) {
            throw new Error("Invalid swap parameters: denominator must be greater than zero");
        }
        return numerator.div(denominator).toString();
    }
    /**
     * Calculate fair LP share value
     */
    calculateLPValue(shareAmount, totalShares, reserveA, reserveB) {
        const shares = new big_js_1.default(shareAmount);
        const total = new big_js_1.default(totalShares);
        const resA = new big_js_1.default(reserveA);
        const resB = new big_js_1.default(reserveB);
        if (total.lte(0)) {
            throw new Error("totalShares must be greater than zero");
        }
        const proportion = shares.div(total);
        return {
            valueA: resA.times(proportion).toString(),
            valueB: resB.times(proportion).toString(),
        };
    }
    /**
     * Calculate slippage
     */
    calculateSlippage(expectedAmount, actualAmount) {
        const expected = new big_js_1.default(expectedAmount);
        const actual = new big_js_1.default(actualAmount);
        if (expected.eq(0)) {
            throw new Error("expectedAmount must be greater than zero");
        }
        const slippageAmount = expected.minus(actual);
        const slippagePercent = slippageAmount.div(expected).times(100);
        return {
            slippageAmount: slippageAmount.toString(),
            slippagePercent: slippagePercent.toFixed(2),
        };
    }
}
exports.PriceCalculator = PriceCalculator;
exports.priceCalculator = new PriceCalculator();
/**
 * Operation profiler for performance monitoring
 */
class OperationProfiler {
    constructor() {
        this.operations = new Map();
    }
    /**
     * Profile an async operation
     */
    async profile(name, operation) {
        const startTime = performance.now();
        try {
            return await operation();
        }
        finally {
            const duration = performance.now() - startTime;
            this.recordOperation(name, duration);
        }
    }
    /**
     * Record operation timing
     */
    recordOperation(name, durationMs) {
        const existing = this.operations.get(name);
        if (existing) {
            this.operations.set(name, {
                calls: existing.calls + 1,
                totalTime: existing.totalTime + durationMs,
                minTime: Math.min(existing.minTime, durationMs),
                maxTime: Math.max(existing.maxTime, durationMs),
            });
        }
        else {
            this.operations.set(name, {
                calls: 1,
                totalTime: durationMs,
                minTime: durationMs,
                maxTime: durationMs,
            });
        }
    }
    /**
     * Get operation stats
     */
    getStats(name) {
        if (name) {
            return this.operations.get(name);
        }
        const stats = {};
        for (const [opName, data] of this.operations.entries()) {
            stats[opName] = {
                calls: data.calls,
                totalTime: data.totalTime.toFixed(2) + "ms",
                avgTime: (data.totalTime / data.calls).toFixed(2) + "ms",
                minTime: data.minTime.toFixed(2) + "ms",
                maxTime: data.maxTime.toFixed(2) + "ms",
            };
        }
        return stats;
    }
    /**
     * Reset stats
     */
    reset() {
        this.operations.clear();
    }
}
exports.OperationProfiler = OperationProfiler;
exports.operationProfiler = new OperationProfiler();
