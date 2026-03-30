import type { Pool, Route, RouteLeg } from "./types";

interface Edge {
  pool: Pool;
  tokenIn: string;
  tokenOut: string;
}

// Calculate output amount for a constant-product AMM swap
// outputAmount = (inputAmount * (1 - fee) * reserveOut) / (reserveIn + inputAmount * (1 - fee))
function calculateAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  fee: number
): bigint {
  const FEE_PRECISION = BigInt(1000000);
  const feeMultiplier = BigInt(Math.round((1 - fee) * Number(FEE_PRECISION)));
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * FEE_PRECISION + amountInWithFee;
  if (denominator === BigInt(0)) return BigInt(0);
  return numerator / denominator;
}

// Calculate price impact as a percentage
function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  amountOut: bigint,
  reserveOut: bigint
): number {
  if (reserveIn === BigInt(0) || reserveOut === BigInt(0)) return 100;
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const executionPrice = Number(amountOut) / Number(amountIn);
  return Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100);
}

interface RouteCandidate {
  token: string;
  amountOut: bigint;
  hops: number;
  legs: RouteLeg[];
  visited: Set<string>;
  totalFees: bigint;
}

export class TokenGraph {
  private adjacency: Map<string, Edge[]> = new Map();

  buildFromPools(pools: Pool[]): void {
    this.adjacency.clear();
    for (const pool of pools) {
      this.addEdge(pool, pool.tokenA, pool.tokenB);
      this.addEdge(pool, pool.tokenB, pool.tokenA);
    }
  }

  private addEdge(pool: Pool, from: string, to: string): void {
    if (!this.adjacency.has(from)) {
      this.adjacency.set(from, []);
    }
    this.adjacency.get(from)!.push({ pool, tokenIn: from, tokenOut: to });
  }

  getTokens(): string[] {
    return Array.from(this.adjacency.keys());
  }

  getEdges(from: string, to: string): Edge[] {
    const edges = this.adjacency.get(from) || [];
    return edges.filter((e) => e.tokenOut === to);
  }

  findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    maxHops: number
  ): Route | null {
    let bestRoute: Route | null = null;

    const queue: RouteCandidate[] = [
      {
        token: tokenIn,
        amountOut: amountIn,
        hops: 0,
        legs: [],
        visited: new Set([tokenIn]),
        totalFees: BigInt(0),
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.token === tokenOut && current.legs.length > 0) {
        const totalPriceImpact = current.legs.reduce((sum, leg) => {
          const reserveIn =
            leg.tokenIn === leg.pool.tokenA
              ? leg.pool.reserveA
              : leg.pool.reserveB;
          const reserveOut =
            leg.tokenIn === leg.pool.tokenA
              ? leg.pool.reserveB
              : leg.pool.reserveA;
          return (
            sum +
            calculatePriceImpact(
              leg.amountIn,
              reserveIn,
              leg.expectedAmountOut,
              reserveOut
            )
          );
        }, 0);

        const route: Route = {
          path: current.legs,
          totalAmountOut: current.amountOut,
          totalPriceImpact: totalPriceImpact,
          totalFees: current.totalFees,
        };

        if (!bestRoute || route.totalAmountOut > bestRoute.totalAmountOut) {
          bestRoute = route;
        }
        continue;
      }

      if (current.hops >= maxHops) continue;

      const edges = this.adjacency.get(current.token) || [];
      for (const edge of edges) {
        if (current.visited.has(edge.tokenOut)) continue;

        const reserveIn =
          edge.tokenIn === edge.pool.tokenA
            ? edge.pool.reserveA
            : edge.pool.reserveB;
        const reserveOut =
          edge.tokenIn === edge.pool.tokenA
            ? edge.pool.reserveB
            : edge.pool.reserveA;

        const output = calculateAmountOut(
          current.amountOut,
          reserveIn,
          reserveOut,
          edge.pool.fee
        );

        if (output <= BigInt(0)) continue;

        const feeAmount =
          (current.amountOut * BigInt(Math.round(edge.pool.fee * 1000000))) /
          BigInt(1000000);

        const leg: RouteLeg = {
          pool: edge.pool,
          tokenIn: edge.tokenIn,
          tokenOut: edge.tokenOut,
          amountIn: current.amountOut,
          expectedAmountOut: output,
        };

        const newVisited = new Set(current.visited);
        newVisited.add(edge.tokenOut);

        queue.push({
          token: edge.tokenOut,
          amountOut: output,
          hops: current.hops + 1,
          legs: [...current.legs, leg],
          visited: newVisited,
          totalFees: current.totalFees + feeAmount,
        });
      }
    }

    return bestRoute;
  }
}

export { calculateAmountOut, calculatePriceImpact };
