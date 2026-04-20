import { 
  quoteSwap as quoteDexSwap, 
  swapBestRoute,
  type StellarAssetInput, 
  type RouteQuote, 
  type RouteMode,
  type DexClientConfig,
  type SwapBestRouteResult
} from "./dex";
import { 
  getReserves,
  swap as contractSwap,
  type SorobanContractConfig 
} from "./contract";
import Big from "big.js";

export interface RouteOptions {
  strategy: "best-route" | "classic" | "soroban";
  slippageBps?: number;
}

export interface UnifiedSwapParams {
  fromAsset: StellarAssetInput;
  toAsset: StellarAssetInput;
  amount: string;
  mode: RouteMode;
  destination?: string;
}

export interface BestRouteResult {
  source: "classic" | "soroban";
  quote: RouteQuote | SorobanQuote;
}

export interface BestLPResult {
  source: "classic" | "soroban";
  poolId: string;
  expectedShares: string;
}

export interface SorobanQuote {
  outAmount: string;
  price: string;
  contractAddress: string;
}

/**
 * RouteOptimizer provides unified pathfinding across Stellar Classic (DEX/AMM)
 * and Soroban-based Liquidity Pools.
 */
export class RouteOptimizer {
  constructor(private dexConfig: DexClientConfig, private sorobanConfig: SorobanContractConfig) {}

  /**
   * Find the best route for a swap.
   */
  async findBestRoute(params: UnifiedSwapParams): Promise<BestRouteResult> {
    // 1. Get Classic DEX routes
    let classicQuotes: RouteQuote[] = [];
    try {
      classicQuotes = await quoteDexSwap(this.dexConfig, {
        mode: params.mode,
        sendAsset: params.fromAsset,
        destAsset: params.toAsset,
        sendAmount: params.mode === "strict-send" ? params.amount : undefined,
        destAmount: params.mode === "strict-receive" ? params.amount : undefined,
        destination: params.destination,
      });
    } catch (e) {
      console.warn("Failed to fetch classic DEX routes:", e);
    }

    // 2. TODO: Query Soroban AMM(s)
    // For now, we only have one Soroban contract address in config.
    // If we knew the assets for that contract, we could query it here.
    // Since we don't have an asset-to-contract mapping yet, we'll favor Classic
    // if available, but this structure allows adding more sources.

    if (classicQuotes.length > 0) {
      return {
        source: "classic",
        quote: classicQuotes[0],
      };
    }

    throw new Error("No routes found for the requested swap");
  }

  /**
   * Execute a swap using the best available route.
   */
  async swap(params: UnifiedSwapParams, options: RouteOptions = { strategy: "best-route" }): Promise<any> {
    if (options.strategy === "soroban") {
      // Legacy Soroban swap (requires specific params which we might need to derive or ask for)
      // This is a placeholder for the legacy flow integrated into the optimizer
      throw new Error("Direct Soroban strategy requires specific contract parameters");
    }

    const { source, quote } = await this.findBestRoute(params);

    if (source === "classic") {
      return await swapBestRoute(this.dexConfig, {
        mode: params.mode,
        sendAsset: params.fromAsset,
        destAsset: params.toAsset,
        sendAmount: params.mode === "strict-send" ? params.amount : undefined,
        destAmount: params.mode === "strict-receive" ? params.amount : undefined,
        destination: params.destination,
        slippageBps: options.slippageBps,
      });
    }

    // Soroban execution would go here if we had Soroban quotes
    throw new Error(`Execution for source ${source} not yet implemented in optimizer`);
  }

  /**
   * Find the best pool for providing liquidity.
   */
  async findBestLPPool(assetA: StellarAssetInput, assetB: StellarAssetInput): Promise<BestLPResult> {
    // 1. Check Classic AMM
    // 2. Check known Soroban AMMs
    
    // Placeholder logic
    return {
      source: "classic",
      poolId: "classic_amm",
      expectedShares: "0"
    };
  }
}
