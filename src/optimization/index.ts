/**
 * Performance Optimization Layer for Stellar AgentKit
 * 
 * Provides caching, memoization, and optimization strategies
 * for frequently called Soroban operations.
 */

import Big from "big.js";
import { validateStellarAddress } from "./validation";

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttlMs: number;
}

/**
 * Generic cache with TTL support
 */
export class TTLCache<K extends string, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private readonly defaultTtl: number;
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

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
  set(key: K, value: V, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttlMs: ttlMs || this.defaultTtl,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete key
   */
  delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
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
  startAutoCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Memoization wrapper for async functions
 */
export function memoizeAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  ttlMs: number = 5 * 60 * 1000,
  keyGenerator?: (...args: TArgs) => string
): (...args: TArgs) => Promise<TReturn> {
  const cache = new TTLCache<string, TReturn>(ttlMs);

  return async (...args: TArgs): Promise<TReturn> => {
    const key = (keyGenerator ? keyGenerator(...args) : JSON.stringify(args)) as string;

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
export class SorobanCaches {
  // Pool reserves cache: contractId -> [reserves]
  poolResources = new TTLCache<string, [bigint, bigint]>(10 * 60 * 1000);

  // Share ID cache: contractId -> shareId
  shareIds = new TTLCache<string, string>(10 * 60 * 1000);

  // Account info cache: address -> sequence
  accountSequences = new TTLCache<string, string>(2 * 60 * 1000);

  // Network state cache
  networkState = new TTLCache<string, any>(1 * 60 * 1000);

  // Swap quotes cache: "from:amount" -> expected output
  swapQuotes = new TTLCache<string, string>(30 * 1000); // 30 second quotes

  constructor() {
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
  clearAll(): void {
    this.poolResources.clear();
    this.shareIds.clear();
    this.accountSequences.clear();
    this.networkState.clear();
    this.swapQuotes.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): {
    poolResources: number;
    shareIds: number;
    accountSequences: number;
    networkState: number;
    swapQuotes: number;
    total: number;
  } {
    return {
      poolResources: this.poolResources.size(),
      shareIds: this.shareIds.size(),
      accountSequences: this.accountSequences.size(),
      networkState: this.networkState.size(),
      swapQuotes: this.swapQuotes.size(),
      total:
        this.poolResources.size() +
        this.shareIds.size() +
        this.accountSequences.size() +
        this.networkState.size() +
        this.swapQuotes.size(),
    };
  }
}

export const sorobanCaches = new SorobanCaches();

/**
 * Price calculation cache and helpers
 */
export class PriceCalculator {
  private exchangeRates = new TTLCache<string, string>(5 * 60 * 1000);

  /**
   * Calculate expected output for swap
   * 
   * Uses constant product formula: x * y = k
   * With 0.3% swap fee
   */
  calculateSwapOutput(
    inputAmount: string,
    reserveIn: string,
    reserveOut: string,
    feePercent: number = 0.003
  ): string {
    const input = new Big(inputAmount);
    const reserveInBig = new Big(reserveIn);
    const reserveOutBig = new Big(reserveOut);
    const fee = new Big(1).minus(feePercent);

    // (input * fee) * reserveOut / (reserveIn + input * fee)
    const amountInWithFee = input.times(fee);
    const numerator = amountInWithFee.times(reserveOutBig);
    const denominator = reserveInBig.plus(amountInWithFee);

    return numerator.div(denominator).toString();
  }

  /**
   * Calculate expected input needed for desired output
   */
  calculateSwapInput(
    outputAmount: string,
    reserveIn: string,
    reserveOut: string,
    feePercent: number = 0.003
  ): string {
    const output = new Big(outputAmount);
    const reserveInBig = new Big(reserveIn);
    const reserveOutBig = new Big(reserveOut);
    const fee = new Big(1).minus(feePercent);

    // (reserveIn * output) / ((reserveOut - output) * fee)
    const numerator = reserveInBig.times(output);
    const denominator = reserveOutBig.minus(output).times(fee);

    return numerator.div(denominator).toString();
  }

  /**
   * Calculate fair LP share value
   */
  calculateLPValue(
    shareAmount: string,
    totalShares: string,
    reserveA: string,
    reserveB: string
  ): { valueA: string; valueB: string } {
    const shares = new Big(shareAmount);
    const total = new Big(totalShares);
    const resA = new Big(reserveA);
    const resB = new Big(reserveB);

    const proportion = shares.div(total);

    return {
      valueA: resA.times(proportion).toString(),
      valueB: resB.times(proportion).toString(),
    };
  }

  /**
   * Calculate slippage
   */
  calculateSlippage(
    expectedAmount: string,
    actualAmount: string
  ): { slippageAmount: string; slippagePercent: string } {
    const expected = new Big(expectedAmount);
    const actual = new Big(actualAmount);

    const slippageAmount = expected.minus(actual);
    const slippagePercent = slippageAmount.div(expected).times(100);

    return {
      slippageAmount: slippageAmount.toString(),
      slippagePercent: slippagePercent.toFixed(2),
    };
  }
}

export const priceCalculator = new PriceCalculator();

/**
 * Operation profiler for performance monitoring
 */
export class OperationProfiler {
  private operations: Map<
    string,
    {
      calls: number;
      totalTime: number;
      minTime: number;
      maxTime: number;
    }
  > = new Map();

  /**
   * Profile an async operation
   */
  async profile<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();

    try {
      return await operation();
    } finally {
      const duration = performance.now() - startTime;
      this.recordOperation(name, duration);
    }
  }

  /**
   * Record operation timing
   */
  private recordOperation(name: string, durationMs: number): void {
    const existing = this.operations.get(name);

    if (existing) {
      this.operations.set(name, {
        calls: existing.calls + 1,
        totalTime: existing.totalTime + durationMs,
        minTime: Math.min(existing.minTime, durationMs),
        maxTime: Math.max(existing.maxTime, durationMs),
      });
    } else {
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
  getStats(name?: string): any {
    if (name) {
      return this.operations.get(name);
    }

    const stats: any = {};
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
  reset(): void {
    this.operations.clear();
  }
}

export const operationProfiler = new OperationProfiler();
