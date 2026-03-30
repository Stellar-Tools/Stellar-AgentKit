// router/types.ts
import { xdr } from "@stellar/stellar-sdk";

export interface Pool {
  id: string;
  dex: string;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  fee: number;
  contractAddress?: string;
  lastUpdated: number;
}

export interface Quote {
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
}

export interface RouteLeg {
  pool: Pool;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  expectedAmountOut: bigint;
}

export interface Route {
  path: RouteLeg[];
  totalAmountOut: bigint;
  totalPriceImpact: number;
  totalFees: bigint;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage: number;
  strategy: "best-route";
  maxHops?: number;
}

export interface SwapResult {
  txHash: string;
  route: {
    path: string[];
    dexes: string[];
    amountIn: string;
    amountOut: string;
    priceImpact: number;
  };
}

export interface NetworkConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  soroswapFactory: string;
  phoenixFactory: string;
}

export interface DexAdapter {
  name: string;
  discoverPools(): Promise<Pool[]>;
  getQuote(pool: Pool, tokenIn: string, amountIn: bigint): Promise<Quote>;
  buildSwapOp(
    pool: Pool,
    tokenIn: string,
    amountIn: bigint,
    minOut: bigint
  ): Promise<xdr.Operation>;
}
