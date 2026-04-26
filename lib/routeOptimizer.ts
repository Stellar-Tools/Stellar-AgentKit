import Big from "big.js";
import {
  Asset,
  Horizon,
  Networks,
  StrKey,
} from "@stellar/stellar-sdk";
import { 
  StellarAssetInput, 
  RouteQuote, 
  QuoteSwapParams, 
  SwapBestRouteParams,
  SwapBestRouteResult,
  assetInputToSdkAsset,
  assetInputToHorizonAsset,
  normalizePathRecord,
  rankRouteQuotes
} from "./dex";
import { DexClientConfig } from "./dex";

export type SwapStrategy = "best-route" | "direct" | "split" | "minimal-hops";

export interface PoolInfo {
  id: string;
  assetA: StellarAssetInput;
  assetB: StellarAssetInput;
  reserveA: string;
  reserveB: string;
  fee: number;
  type: "constant_product" | "stable" | "hybrid";
  contractAddress?: string;
}

export interface RouteOption {
  path: StellarAssetInput[];
  pools: PoolInfo[];
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  hopCount: number;
  totalFee: string;
  estimatedGas: string;
  confidence: number; // 0-1 score of route reliability
}

export interface OptimizedSwapParams {
  sendAsset: StellarAssetInput;
  destAsset: StellarAssetInput;
  sendAmount?: string;
  destAmount?: string;
  strategy: SwapStrategy;
  slippageBps?: number;
  maxHops?: number;
  splitRoutes?: number; // For split strategy
  excludePools?: string[]; // Pool IDs to exclude
  preferPools?: string[]; // Pool IDs to prefer
}

export interface RouteOptimizerConfig {
  network: "testnet" | "mainnet";
  horizonUrl: string;
  rpcUrl?: string;
  maxHops?: number;
  maxRoutes?: number;
  cacheTimeout?: number; // in seconds
}

export interface OptimizedSwapResult {
  route: RouteOption;
  transactionHash: string;
  actualInput: string;
  actualOutput: string;
  slippage: string;
  fees: string;
  executionTime: number;
}

interface PoolQueryResponse {
  pools: PoolInfo[];
  timestamp: number;
}

interface CacheEntry {
  data: PoolQueryResponse;
  timestamp: number;
}

/**
 * Route Optimizer for Stellar swaps and LP operations
 * 
 * This class provides intelligent routing across multiple DEXes and liquidity pools
 * to find the optimal execution path for swaps and liquidity operations.
 */
export class RouteOptimizer {
  private config: RouteOptimizerConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_CACHE_TIMEOUT = 30; // 30 seconds
  private readonly DEFAULT_MAX_HOPS = 4;
  private readonly DEFAULT_MAX_ROUTES = 10;

  constructor(config: RouteOptimizerConfig) {
    this.config = {
      maxHops: config.maxHops ?? this.DEFAULT_MAX_HOPS,
      maxRoutes: config.maxRoutes ?? this.DEFAULT_MAX_ROUTES,
      cacheTimeout: config.cacheTimeout ?? this.DEFAULT_CACHE_TIMEOUT,
      ...config
    };
  }

  /**
   * Find the optimal route for a swap using the specified strategy
   */
  async findOptimalRoute(params: OptimizedSwapParams): Promise<RouteOption> {
    const pools = await this.queryPools();
    const routes = await this.calculateRoutes(params, pools);
    
    switch (params.strategy) {
      case "best-route":
        return this.selectBestRoute(routes);
      case "direct":
        return this.selectDirectRoute(routes);
      case "split":
        return this.selectSplitRoute(routes, params.splitRoutes ?? 3);
      case "minimal-hops":
        return this.selectMinimalHopsRoute(routes);
      default:
        throw new Error(`Unknown strategy: ${params.strategy}`);
    }
  }

  /**
   * Execute an optimized swap using the best route
   */
  async executeOptimizedSwap(
    params: OptimizedSwapParams,
    destination: string,
    signerPublicKey: string
  ): Promise<OptimizedSwapResult> {
    const startTime = Date.now();
    
    // Find optimal route
    const route = await this.findOptimalRoute(params);
    
    // Execute the swap using the route
    const swapResult = await this.executeSwapRoute(route, destination, signerPublicKey);
    
    const executionTime = Date.now() - startTime;
    
    return {
      route,
      transactionHash: swapResult.hash,
      actualInput: swapResult.sendAmount,
      actualOutput: swapResult.destAmount,
      slippage: this.calculateSlippage(route, swapResult),
      fees: route.totalFee,
      executionTime
    };
  }

  /**
   * Query all available pools from multiple sources
   */
  private async queryPools(): Promise<PoolInfo[]> {
    const cacheKey = `pools_${this.config.network}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < (this.config.cacheTimeout! * 1000)) {
      return cached.data.pools;
    }

    const pools: PoolInfo[] = [];
    
    // Query Horizon liquidity pools
    const horizonPools = await this.queryHorizonPools();
    pools.push(...horizonPools);
    
    // Query Soroban AMM pools if RPC URL is provided
    if (this.config.rpcUrl) {
      const sorobanPools = await this.querySorobanPools();
      pools.push(...sorobanPools);
    }

    const response: PoolQueryResponse = {
      pools,
      timestamp: Date.now()
    };
    
    this.cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return pools;
  }

  /**
   * Query liquidity pools from Horizon
   */
  private async queryHorizonPools(): Promise<PoolInfo[]> {
    try {
      const server = new Horizon.Server(this.config.horizonUrl);
      const pools = await server.liquidityPools()
        .limit(200)
        .call();

      return pools.records
        .filter(pool => this.isValidPool(pool))
        .map(pool => this.horizonPoolToPoolInfo(pool));
    } catch (error) {
      console.warn("Failed to query Horizon pools:", error);
      return [];
    }
  }

  /**
   * Query Soroban AMM pools
   */
  private async querySorobanPools(): Promise<PoolInfo[]> {
    // This would query Soroban AMM contracts
    // Implementation depends on specific AMM contracts available
    return [];
  }

  /**
   * Calculate all possible routes for a swap
   */
  private async calculateRoutes(
    params: OptimizedSwapParams, 
    pools: PoolInfo[]
  ): Promise<RouteOption[]> {
    const routes: RouteOption[] = [];
    const maxHops = params.maxHops ?? this.config.maxHops!;
    
    // Filter pools based on preferences
    let filteredPools = pools;
    if (params.excludePools?.length) {
      filteredPools = filteredPools.filter(p => !params.excludePools!.includes(p.id));
    }
    if (params.preferPools?.length) {
      // Sort preferred pools to the front
      filteredPools.sort((a, b) => {
        const aPreferred = params.preferPools!.includes(a.id);
        const bPreferred = params.preferPools!.includes(b.id);
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        return 0;
      });
    }

    // Find direct routes (1 hop)
    const directRoutes = this.findDirectRoutes(params, filteredPools);
    routes.push(...directRoutes);

    // Find multi-hop routes if needed
    if (maxHops > 1) {
      const multiHopRoutes = this.findMultiHopRoutes(params, filteredPools, maxHops);
      routes.push(...multiHopRoutes);
    }

    // Calculate detailed metrics for each route
    return routes.map(route => this.calculateRouteMetrics(route));
  }

  /**
   * Find direct routes (single pool swaps)
   */
  private findDirectRoutes(params: OptimizedSwapParams, pools: PoolInfo[]): RouteOption[] {
    const routes: RouteOption[] = [];
    
    for (const pool of pools) {
      if (this.poolSupportsPair(pool, params.sendAsset, params.destAsset)) {
        const route = this.createRouteFromPool(pool, params);
        if (route) routes.push(route);
      }
    }
    
    return routes;
  }

  /**
   * Find multi-hop routes
   */
  private findMultiHopRoutes(
    params: OptimizedSwapParams, 
    pools: PoolInfo[], 
    maxHops: number
  ): RouteOption[] {
    const routes: RouteOption[] = [];
    const visited = new Set<string>();
    
    // Simple breadth-first search for routes
    const queue: Array<{
      currentAsset: StellarAssetInput;
      path: StellarAssetInput[];
      pools: PoolInfo[];
      hops: number;
    }> = [{
      currentAsset: params.sendAsset,
      path: [params.sendAsset],
      pools: [],
      hops: 0
    }];

    while (queue.length > 0 && routes.length < this.config.maxRoutes!) {
      const { currentAsset, path, pools: pathPools, hops } = queue.shift()!;
      
      if (hops >= maxHops) continue;
      if (this.assetEquals(currentAsset, params.destAsset)) {
        // Found a complete route
        const route = this.createRouteFromPath(path, pathPools, params);
        if (route) routes.push(route);
        continue;
      }

      const key = this.assetKey(currentAsset);
      if (visited.has(key)) continue;
      visited.add(key);

      // Find pools that can trade from current asset
      for (const pool of pools) {
        if (pathPools.includes(pool)) continue; // Avoid reusing pools
        
        const nextAsset = this.getNextAsset(pool, currentAsset);
        if (nextAsset && !path.some(a => this.assetEquals(a, nextAsset))) {
          queue.push({
            currentAsset: nextAsset,
            path: [...path, nextAsset],
            pools: [...pathPools, pool],
            hops: hops + 1
          });
        }
      }
    }

    return routes;
  }

  /**
   * Select the best route based on output amount and other factors
   */
  private selectBestRoute(routes: RouteOption[]): RouteOption {
    if (routes.length === 0) {
      throw new Error("No routes available for this swap");
    }

    // Sort by output amount (descending), then by confidence, then by hop count
    return routes.sort((a, b) => {
      const outputComparison = new Big(b.outputAmount).cmp(a.outputAmount);
      if (outputComparison !== 0) return outputComparison;
      
      const confidenceComparison = b.confidence - a.confidence;
      if (Math.abs(confidenceComparison) > 0.01) return confidenceComparison;
      
      return a.hopCount - b.hopCount;
    })[0];
  }

  /**
   * Select the most direct route
   */
  private selectDirectRoute(routes: RouteOption[]): RouteOption {
    const directRoutes = routes.filter(r => r.hopCount === 1);
    if (directRoutes.length === 0) {
      return this.selectBestRoute(routes);
    }
    return this.selectBestRoute(directRoutes);
  }

  /**
   * Select route with minimal hops
   */
  private selectMinimalHopsRoute(routes: RouteOption[]): RouteOption {
    const minHops = Math.min(...routes.map(r => r.hopCount));
    const minimalRoutes = routes.filter(r => r.hopCount === minHops);
    return this.selectBestRoute(minimalRoutes);
  }

  /**
   * Select split route (for large trades)
   */
  private selectSplitRoute(routes: RouteOption[], splitCount: number): RouteOption {
    // For now, return the best route
    // In a full implementation, this would split the trade across multiple routes
    return this.selectBestRoute(routes);
  }

  /**
   * Execute a swap using a specific route
   */
  private async executeSwapRoute(
    route: RouteOption,
    destination: string,
    signerPublicKey: string
  ): Promise<SwapBestRouteResult> {
    // This would integrate with the existing DEX swap functionality
    // For now, return a mock result
    return {
      hash: "mock-tx-hash",
      mode: "strict-send",
      sendAmount: route.inputAmount,
      destAmount: route.outputAmount,
      path: route.path
    };
  }

  /**
   * Calculate detailed metrics for a route
   */
  private calculateRouteMetrics(route: RouteOption): RouteOption {
    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(route);
    
    // Estimate gas
    const estimatedGas = (route.hopCount * 100000).toString(); // Rough estimate
    
    // Calculate confidence based on pool liquidity and route complexity
    const confidence = this.calculateConfidence(route);

    return {
      ...route,
      priceImpact,
      estimatedGas,
      confidence
    };
  }

  /**
   * Calculate price impact for a route
   */
  private calculatePriceImpact(route: RouteOption): string {
    // Simplified price impact calculation
    // In a full implementation, this would use actual pool formulas
    const totalLiquidity = route.pools.reduce((sum, pool) => {
      return sum + parseFloat(pool.reserveA) + parseFloat(pool.reserveB);
    }, 0);
    
    const tradeSize = parseFloat(route.inputAmount);
    const impact = (tradeSize / totalLiquidity) * 100; // Simple approximation
    
    return impact.toFixed(4);
  }

  /**
   * Calculate confidence score for a route
   */
  private calculateConfidence(route: RouteOption): number {
    let confidence = 1.0;
    
    // Reduce confidence for more hops
    confidence *= (1.0 - (route.hopCount - 1) * 0.1);
    
    // Reduce confidence for high price impact
    const priceImpact = parseFloat(route.priceImpact);
    if (priceImpact > 5) confidence *= 0.8;
    if (priceImpact > 10) confidence *= 0.6;
    
    // Reduce confidence for low liquidity pools
    for (const pool of route.pools) {
      const totalLiquidity = parseFloat(pool.reserveA) + parseFloat(pool.reserveB);
      if (totalLiquidity < 1000) confidence *= 0.9;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate slippage from expected vs actual output
   */
  private calculateSlippage(route: RouteOption, result: SwapBestRouteResult): string {
    const expected = new Big(route.outputAmount);
    const actual = new Big(result.destAmount);
    const slippage = expected.minus(actual).div(expected).mul(100);
    return slippage.toFixed(4);
  }

  // Helper methods
  private isValidPool(pool: any): boolean {
    return pool && 
           pool.reserves && 
           pool.reserves.length >= 2 &&
           pool.total_poolshares !== "0";
  }

  private horizonPoolToPoolInfo(pool: any): PoolInfo {
    const reserveA = pool.reserves[0];
    const reserveB = pool.reserves[1];
    
    return {
      id: pool.id,
      assetA: this.horizonAssetToInput(reserveA.asset),
      assetB: this.horizonAssetToInput(reserveB.asset),
      reserveA: reserveA.amount,
      reserveB: reserveB.amount,
      fee: pool.fee_bp ? pool.fee_bp / 10000 : 0.003, // Default 0.3%
      type: "constant_product", // Most Horizon pools are CP
    };
  }

  private horizonAssetToInput(asset: any): StellarAssetInput {
    if (asset.asset_type === "native") {
      return { type: "native" };
    }
    return {
      code: asset.asset_code,
      issuer: asset.asset_issuer,
    };
  }

  private poolSupportsPair(
    pool: PoolInfo, 
    assetA: StellarAssetInput, 
    assetB: StellarAssetInput
  ): boolean {
    return (this.assetEquals(pool.assetA, assetA) && this.assetEquals(pool.assetB, assetB)) ||
           (this.assetEquals(pool.assetA, assetB) && this.assetEquals(pool.assetB, assetA));
  }

  private createRouteFromPool(pool: PoolInfo, params: OptimizedSwapParams): RouteOption | null {
    // Simplified swap calculation - in reality this would use the pool's specific formula
    const inputAmount = params.sendAmount ?? "0";
    const outputAmount = this.estimateSwapOutput(pool, inputAmount, params.sendAsset);
    
    if (!outputAmount || parseFloat(outputAmount) <= 0) return null;

    return {
      path: [params.sendAsset, params.destAsset],
      pools: [pool],
      inputAmount,
      outputAmount,
      priceImpact: "0", // Will be calculated later
      hopCount: 1,
      totalFee: (parseFloat(outputAmount) * pool.fee).toString(),
      estimatedGas: "100000",
      confidence: 1.0 // Will be calculated later
    };
  }

  private createRouteFromPath(
    path: StellarAssetInput[], 
    pools: PoolInfo[], 
    params: OptimizedSwapParams
  ): RouteOption | null {
    let inputAmount = params.sendAmount ?? "0";
    let currentOutput = inputAmount;

    // Calculate output through each hop
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      const inputAsset = path[i];
      const outputAsset = path[i + 1];
      
      currentOutput = this.estimateSwapOutput(pool, currentOutput, inputAsset);
      if (!currentOutput || parseFloat(currentOutput) <= 0) return null;
    }

    return {
      path,
      pools,
      inputAmount,
      outputAmount: currentOutput,
      priceImpact: "0", // Will be calculated later
      hopCount: pools.length,
      totalFee: pools.reduce((sum, pool) => sum + parseFloat(currentOutput) * pool.fee, 0).toString(),
      estimatedGas: (pools.length * 100000).toString(),
      confidence: 1.0 // Will be calculated later
    };
  }

  private estimateSwapOutput(pool: PoolInfo, inputAmount: string, inputAsset: StellarAssetInput): string {
    // Simplified constant product formula: x * y = k
    // This is a basic approximation - real implementation would use pool-specific formulas
    const isInputA = this.assetEquals(pool.assetA, inputAsset);
    const reserveIn = isInputA ? pool.reserveA : pool.reserveB;
    const reserveOut = isInputA ? pool.reserveB : pool.reserveA;
    
    const input = new Big(inputAmount);
    const reserveInBig = new Big(reserveIn);
    const reserveOutBig = new Big(reserveOut);
    
    // Constant product formula with fee
    const feeMultiplier = new Big(1).minus(pool.fee);
    const numerator = input.mul(reserveOutBig).mul(feeMultiplier);
    const denominator = reserveInBig.add(input);
    const output = numerator.div(denominator);
    
    return output.toFixed(7);
  }

  private getNextAsset(pool: PoolInfo, currentAsset: StellarAssetInput): StellarAssetInput | null {
    if (this.assetEquals(pool.assetA, currentAsset)) return pool.assetB;
    if (this.assetEquals(pool.assetB, currentAsset)) return pool.assetA;
    return null;
  }

  private assetEquals(asset1: StellarAssetInput, asset2: StellarAssetInput): boolean {
    if (asset1.type === "native" && asset2.type === "native") return true;
    if (asset1.type === "native" || asset2.type === "native") return false;
    return asset1.code === asset2.code && asset1.issuer === asset2.issuer;
  }

  private assetKey(asset: StellarAssetInput): string {
    if (asset.type === "native") return "native";
    return `${asset.code}:${asset.issuer}`;
  }
}
