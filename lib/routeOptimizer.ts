import Big from "big.js";
import {
  Asset,
  Horizon,
  Networks,
  StrKey,
  rpc,
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
    try {
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
          const sendAsset = 'type' in params.sendAsset ? 'XLM' : `${params.sendAsset.code}:${params.sendAsset.issuer}`;
          const destAsset = 'type' in params.destAsset ? 'XLM' : `${params.destAsset.code}:${params.destAsset.issuer}`;
          const amount = params.sendAmount || params.destAmount || 'unknown';
          
          throw new Error(
            `Unknown swap strategy: ${params.strategy} on ${this.config.network} network. ` +
            `Supported strategies: best-route, direct, split, minimal-hops. ` +
            `Swap details: ${sendAsset} → ${destAsset}, Amount: ${amount}`
          );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'RouteOptimizerError') {
        throw error;
      }
      
      const sendAsset = 'type' in params.sendAsset ? 'XLM' : `${params.sendAsset.code}:${params.sendAsset.issuer}`;
      const destAsset = 'type' in params.destAsset ? 'XLM' : `${params.destAsset.code}:${params.destAsset.issuer}`;
      const amount = params.sendAmount || params.destAmount || 'unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const enhancedError = new Error(
        `Route optimization failed on ${this.config.network} network. ` +
        `Strategy: ${params.strategy}, Path: ${sendAsset} → ${destAsset}, Amount: ${amount}. ` +
        `Original error: ${errorMessage}`
      );
      enhancedError.name = 'RouteOptimizerError';
      
      throw enhancedError;
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
    
    try {
      const route = await this.findOptimalRoute(params);
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
    } catch (error) {
      if (error instanceof Error && (error.name === 'RouteOptimizerError' || error.name === 'SwapExecutionError')) {
        throw error;
      }
      
      const sendAsset = 'type' in params.sendAsset ? 'XLM' : `${params.sendAsset.code}:${params.sendAsset.issuer}`;
      const destAsset = 'type' in params.destAsset ? 'XLM' : `${params.destAsset.code}:${params.destAsset.issuer}`;
      const amount = params.sendAmount || params.destAmount || 'unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const enhancedError = new Error(
        `Optimized swap execution failed on ${this.config.network} network. ` +
        `Strategy: ${params.strategy}, Path: ${sendAsset} → ${destAsset}, Amount: ${amount}, ` +
        `Destination: ${destination}. Original error: ${errorMessage}`
      );
      enhancedError.name = 'OptimizedSwapExecutionError';
      
      throw enhancedError;
    }
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
    if (!this.config.rpcUrl) {
      return [];
    }

    try {
      const server = new rpc.Server(this.config.rpcUrl, { allowHttp: true });
      
      // This is a basic implementation that would need to be customized
      // based on the actual Soroban AMM contracts available
      // For now, we'll return an empty array as the specific contracts
      // would need to be known and integrated
      
      // Example of how this might work:
      // 1. Query known AMM contract addresses
      // 2. Call contract methods to get pool information
      // 3. Convert to PoolInfo format
      
      console.warn("Soroban pool discovery not yet implemented - requires specific AMM contract integration");
      return [];
    } catch (error) {
      console.warn("Failed to query Soroban pools:", error);
      return [];
    }
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

    // Find direct routes (1 hop) - route creation methods now handle destAmount properly
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
    const globalVisited = new Set<string>(); // Track globally visited asset pairs to prevent infinite loops
    
    // Simple breadth-first search for routes
    const queue: Array<{
      currentAsset: StellarAssetInput;
      path: StellarAssetInput[];
      pools: PoolInfo[];
      hops: number;
      visitedPath: Set<string>; // Track visited assets in this specific path
    }> = [{
      currentAsset: params.sendAsset,
      path: [params.sendAsset],
      pools: [],
      hops: 0,
      visitedPath: new Set<string>()
    }];

    while (queue.length > 0 && routes.length < this.config.maxRoutes!) {
      const { currentAsset, path, pools: pathPools, hops, visitedPath } = queue.shift()!;
      
      if (hops >= maxHops) continue;
      if (this.assetEquals(currentAsset, params.destAsset)) {
        // Found a complete route
        const route = this.createRouteFromPath(path, pathPools, params);
        if (route) routes.push(route);
        continue;
      }

      const currentKey = this.assetKey(currentAsset);
      
      // Check if we've already explored this asset at this hop level globally
      const globalKey = `${currentKey}_${hops}`;
      if (globalVisited.has(globalKey)) continue;
      globalVisited.add(globalKey);

      // Find pools that can trade from current asset
      for (const pool of pools) {
        if (pathPools.includes(pool)) continue; // Avoid reusing pools
        
        const nextAsset = this.getNextAsset(pool, currentAsset);
        if (nextAsset && !visitedPath.has(this.assetKey(nextAsset))) {
          const newVisitedPath = new Set(visitedPath);
          newVisitedPath.add(currentKey);
          
          queue.push({
            currentAsset: nextAsset,
            path: [...path, nextAsset],
            pools: [...pathPools, pool],
            hops: hops + 1,
            visitedPath: newVisitedPath
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
      throw new Error(
        `No routes available for this swap on ${this.config.network} network. ` +
        `This could be due to insufficient liquidity, unsupported asset pairs, or network connectivity issues. ` +
        `Please check asset validity and available liquidity pools.`
      );
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
    if (routes.length === 0) {
      throw new Error(
        `No routes available for split swap on ${this.config.network} network. ` +
        `Split strategy requested with ${splitCount} routes but no viable routes found. ` +
        `This could be due to insufficient liquidity, unsupported asset pairs, or network connectivity issues. ` +
        `Consider using a different strategy or check asset validity.`
      );
    }

    // For split strategy, we want to distribute the trade across multiple routes
    // to reduce price impact and improve execution
    const sortedRoutes = routes.sort((a, b) => {
      // Sort by price impact (ascending), then by output amount (descending)
      const impactComparison = parseFloat(a.priceImpact) - parseFloat(b.priceImpact);
      if (Math.abs(impactComparison) > 0.01) return impactComparison;
      
      return new Big(b.outputAmount).cmp(a.outputAmount);
    });

    // Select the top routes for splitting (up to splitCount)
    const selectedRoutes = sortedRoutes.slice(0, Math.min(splitCount, sortedRoutes.length));
    
    // Create a composite route that represents the split strategy
    const totalOutput = selectedRoutes.reduce((sum, route) => sum + parseFloat(route.outputAmount), 0);
    const totalInput = selectedRoutes.reduce((sum, route) => sum + parseFloat(route.inputAmount), 0);
    const avgPriceImpact = selectedRoutes.reduce((sum, route) => sum + parseFloat(route.priceImpact), 0) / selectedRoutes.length;
    const avgConfidence = selectedRoutes.reduce((sum, route) => sum + route.confidence, 0) / selectedRoutes.length;
    const maxHops = Math.max(...selectedRoutes.map(r => r.hopCount));
    const totalFees = selectedRoutes.reduce((sum, route) => sum + parseFloat(route.totalFee), 0);
    const totalGas = selectedRoutes.reduce((sum, route) => sum + parseFloat(route.estimatedGas), 0);

    // Use the best route's path as the representative path
    const bestRoute = selectedRoutes[0];

    return {
      path: bestRoute.path,
      pools: bestRoute.pools,
      inputAmount: totalInput.toString(),
      outputAmount: totalOutput.toString(),
      priceImpact: avgPriceImpact.toFixed(4),
      hopCount: maxHops,
      totalFee: totalFees.toString(),
      estimatedGas: totalGas.toString(),
      confidence: Math.max(0.1, Math.min(1.0, avgConfidence * 0.95)) // Slightly lower confidence for split
    };
  }

  /**
   * Execute a swap using a specific route
   */
  private async executeSwapRoute(
    route: RouteOption,
    destination: string,
    signerPublicKey: string
  ): Promise<SwapBestRouteResult> {
    // For single-hop routes, use direct swap
    if (route.hopCount === 1) {
      // This would integrate with contract swaps or DEX swaps
      // For now, we'll use the existing DEX swap functionality
      try {
        const { swapBestRoute } = await import("./dex");
        const result = await swapBestRoute(
          {
            network: this.config.network,
            horizonUrl: this.config.horizonUrl,
            publicKey: signerPublicKey,
          },
          {
            mode: "strict-send",
            sendAsset: route.path[0],
            destAsset: route.path[1],
            sendAmount: route.inputAmount,
            slippageBps: 100 // Default slippage
          }
        );
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const sendAsset = 'type' in route.path[0] ? 'XLM' : `${route.path[0].code}:${route.path[0].issuer}`;
        const destAsset = 'type' in route.path[1] ? 'XLM' : `${route.path[1].code}:${route.path[1].issuer}`;
        
        const enhancedError = new Error(
          `Failed to execute swap route on ${this.config.network} network. ` +
          `Path: ${sendAsset} → ${destAsset}, Input amount: ${route.inputAmount}, ` +
          `Hop count: ${route.hopCount}, Destination: ${destination}. ` +
          `Original error: ${errorMessage}`
        );
        enhancedError.name = 'SwapExecutionError';
        
        throw enhancedError;
      }
    } else {
      // For multi-hop routes, we need to execute each hop sequentially
      // This is a complex implementation that would require atomic execution
      // For now, throw an error indicating multi-hop execution is not yet implemented
      const pathDescription = route.path.map(asset => 
        'type' in asset ? 'XLM' : `${asset.code}:${asset.issuer}`
      ).join(' → ');
      
      throw new Error(
        `Multi-hop route execution is not yet implemented on ${this.config.network} network. ` +
        `Requested path: ${pathDescription} (${route.hopCount} hops), Input amount: ${route.inputAmount}. ` +
        `Please use single-hop routes or implement multi-hop execution logic.`
      );
    }
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
    // Pass the newly computed price impact instead of using stale data
    const confidence = this.calculateConfidence(route, priceImpact);

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
  private calculateConfidence(route: RouteOption, priceImpact?: string): number {
    let confidence = 1.0;
    
    // Reduce confidence for more hops
    confidence *= (1.0 - (route.hopCount - 1) * 0.1);
    
    // Reduce confidence for high price impact (use provided price impact or fall back to route data)
    const impactValue = priceImpact ? parseFloat(priceImpact) : parseFloat(route.priceImpact);
    if (impactValue > 5) confidence *= 0.8;
    if (impactValue > 10) confidence *= 0.6;
    
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
    let inputAmount: string;
    let outputAmount: string;

    if (params.sendAmount && !params.destAmount) {
      // sendAmount-only case: calculate output from input
      inputAmount = params.sendAmount;
      outputAmount = this.estimateSwapOutput(pool, inputAmount, params.sendAsset);
    } else if (params.destAmount && !params.sendAmount) {
      // destAmount-only case: calculate required input from desired output
      outputAmount = params.destAmount;
      inputAmount = this.estimateRequiredInput(pool, outputAmount, params.destAsset);
    } else if (params.sendAmount && params.destAmount) {
      // Both provided: use sendAmount and validate against destAmount
      inputAmount = params.sendAmount;
      const calculatedOutput = this.estimateSwapOutput(pool, inputAmount, params.sendAsset);
      outputAmount = calculatedOutput;
    } else {
      // Neither provided: default to 0
      return null;
    }
    
    if (!outputAmount || parseFloat(outputAmount) <= 0) return null;
    if (!inputAmount || parseFloat(inputAmount) <= 0) return null;

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
    let inputAmount: string;
    let outputAmount: string;

    if (params.sendAmount && !params.destAmount) {
      // sendAmount-only case: forward calculation
      inputAmount = params.sendAmount;
      let currentOutput = inputAmount;

      // Calculate output through each hop
      for (let i = 0; i < pools.length; i++) {
        const pool = pools[i];
        const inputAsset = path[i];
        
        currentOutput = this.estimateSwapOutput(pool, currentOutput, inputAsset);
        if (!currentOutput || parseFloat(currentOutput) <= 0) return null;
      }
      outputAmount = currentOutput;
    } else if (params.destAmount && !params.sendAmount) {
      // destAmount-only case: reverse calculation (simplified for multi-hop)
      outputAmount = params.destAmount;
      let currentInput = outputAmount;

      // Reverse calculate through each hop (from end to start)
      for (let i = pools.length - 1; i >= 0; i--) {
        const pool = pools[i];
        const outputAsset = path[i + 1];
        
        currentInput = this.estimateRequiredInput(pool, currentInput, outputAsset);
        if (!currentInput || parseFloat(currentInput) <= 0) return null;
      }
      inputAmount = currentInput;
    } else if (params.sendAmount && params.destAmount) {
      // Both provided: use sendAmount and calculate forward
      inputAmount = params.sendAmount;
      let currentOutput = inputAmount;

      for (let i = 0; i < pools.length; i++) {
        const pool = pools[i];
        const inputAsset = path[i];
        
        currentOutput = this.estimateSwapOutput(pool, currentOutput, inputAsset);
        if (!currentOutput || parseFloat(currentOutput) <= 0) return null;
      }
      outputAmount = currentOutput;
    } else {
      // Neither provided
      return null;
    }

    return {
      path,
      pools,
      inputAmount,
      outputAmount,
      priceImpact: "0", // Will be calculated later
      hopCount: pools.length,
      totalFee: pools.reduce((sum, pool) => sum + parseFloat(outputAmount) * pool.fee, 0).toString(),
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

  private estimateRequiredInput(pool: PoolInfo, desiredOutput: string, outputAsset: StellarAssetInput): string {
    // Reverse calculation: given desired output, calculate required input
    // Using the inverse of the constant product formula
    const isOutputA = this.assetEquals(pool.assetA, outputAsset);
    const reserveIn = isOutputA ? pool.reserveB : pool.reserveA; // Input reserve
    const reserveOut = isOutputA ? pool.reserveA : pool.reserveB; // Output reserve
    
    const output = new Big(desiredOutput);
    const reserveInBig = new Big(reserveIn);
    const reserveOutBig = new Big(reserveOut);
    
    // Inverse formula: input = (output * reserveIn) / (reserveOut - output) / (1 - fee)
    const feeMultiplier = new Big(1).minus(pool.fee);
    const numerator = output.mul(reserveInBig);
    const denominator = reserveOutBig.minus(output).mul(feeMultiplier);
    
    // Check for division by zero
    if (denominator.eq(0)) {
      throw new Error("Invalid pool state: denominator cannot be zero");
    }
    
    const input = numerator.div(denominator);
    
    return input.toFixed(7);
  }

  private getNextAsset(pool: PoolInfo, currentAsset: StellarAssetInput): StellarAssetInput | null {
    if (this.assetEquals(pool.assetA, currentAsset)) return pool.assetB;
    if (this.assetEquals(pool.assetB, currentAsset)) return pool.assetA;
    return null;
  }

  private assetEquals(asset1: StellarAssetInput, asset2: StellarAssetInput): boolean {
    if ('type' in asset1 && 'type' in asset2 && asset1.type === "native" && asset2.type === "native") return true;
    if ('type' in asset1 || 'type' in asset2) return false;
    return asset1.code === asset2.code && asset1.issuer === asset2.issuer;
  }

  private assetKey(asset: StellarAssetInput): string {
    if ('type' in asset && asset.type === "native") return "native";
    // At this point, TypeScript knows asset is not native, so it has code and issuer
    const nonNativeAsset = asset as { code: string; issuer: string };
    return `${nonNativeAsset.code}:${nonNativeAsset.issuer}`;
  }
}
