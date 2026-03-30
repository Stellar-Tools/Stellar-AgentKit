import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwapRouter } from "../../../router/router";
import type { DexAdapter, Pool, Quote, NetworkConfig } from "../../../router/types";
import { xdr } from "@stellar/stellar-sdk";

function makePool(overrides: Partial<Pool> & Pick<Pool, "id" | "tokenA" | "tokenB">): Pool {
  return {
    dex: "soroswap",
    reserveA: BigInt("10000000000"),
    reserveB: BigInt("5000000000"),
    fee: 0.003,
    lastUpdated: Date.now(),
    contractAddress: "CPOOL123",
    ...overrides,
  };
}

function createMockAdapter(name: string, pools: Pool[]): DexAdapter {
  return {
    name,
    discoverPools: vi.fn().mockResolvedValue(pools),
    getQuote: vi.fn().mockImplementation(async (pool: Pool, tokenIn: string, amountIn: bigint) => {
      const isTokenA = tokenIn === pool.tokenA;
      const reserveIn = isTokenA ? pool.reserveA : pool.reserveB;
      const reserveOut = isTokenA ? pool.reserveB : pool.reserveA;
      const FEE_PRECISION = BigInt(1000);
      const feeNumerator = BigInt(3);
      const amountInWithFee = amountIn * (FEE_PRECISION - feeNumerator);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * FEE_PRECISION + amountInWithFee;
      const amountOut = denominator > BigInt(0) ? numerator / denominator : BigInt(0);
      return { amountOut, priceImpact: 0.1, fee: (amountIn * feeNumerator) / FEE_PRECISION } as Quote;
    }),
    buildSwapOp: vi.fn().mockResolvedValue({} as xdr.Operation),
  };
}

const testConfig: NetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  soroswapFactory: "CFACTORY",
  phoenixFactory: "CPHOENIX",
};

describe("SwapRouter", () => {
  let router: SwapRouter;

  beforeEach(() => {
    router = new SwapRouter(testConfig);
  });

  it("should find the best route for a direct swap", async () => {
    const pools = [
      makePool({
        id: "p1",
        tokenA: "XLM",
        tokenB: "USDC",
        reserveA: BigInt("10000000000"),
        reserveB: BigInt("5000000000"),
        dex: "soroswap",
      }),
    ];
    router.registerAdapter(createMockAdapter("soroswap", pools));

    const route = await router.findBestRoute("XLM", "USDC", BigInt("1000000"));
    expect(route).not.toBeNull();
    expect(route!.path).toHaveLength(1);
    expect(route!.totalAmountOut).toBeGreaterThan(BigInt(0));
  });

  it("should find multi-hop route across DEXes", async () => {
    const soroswapPools = [
      makePool({
        id: "p1",
        tokenA: "XLM",
        tokenB: "USDC",
        dex: "soroswap",
        reserveA: BigInt("10000000000"),
        reserveB: BigInt("5000000000"),
      }),
    ];
    const phoenixPools = [
      makePool({
        id: "p2",
        tokenA: "USDC",
        tokenB: "ETH",
        dex: "phoenix",
        reserveA: BigInt("5000000000"),
        reserveB: BigInt("2500000000"),
      }),
    ];

    router.registerAdapter(createMockAdapter("soroswap", soroswapPools));
    router.registerAdapter(createMockAdapter("phoenix", phoenixPools));

    const route = await router.findBestRoute("XLM", "ETH", BigInt("1000000"));
    expect(route).not.toBeNull();
    expect(route!.path).toHaveLength(2);
    expect(route!.path[0].tokenOut).toBe("USDC");
    expect(route!.path[1].tokenOut).toBe("ETH");
  });

  it("should return null when no route exists", async () => {
    const pools = [
      makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC", dex: "soroswap" }),
    ];
    router.registerAdapter(createMockAdapter("soroswap", pools));

    const route = await router.findBestRoute("XLM", "BTC", BigInt("1000000"));
    expect(route).toBeNull();
  });

  it("should choose better rate across competing DEXes", async () => {
    const soroswapPools = [
      makePool({
        id: "p1",
        tokenA: "XLM",
        tokenB: "USDC",
        dex: "soroswap",
        reserveA: BigInt("1000000"),
        reserveB: BigInt("500000"),
        fee: 0.003,
      }),
    ];
    const phoenixPools = [
      makePool({
        id: "p2",
        tokenA: "XLM",
        tokenB: "USDC",
        dex: "phoenix",
        reserveA: BigInt("100000000000"),
        reserveB: BigInt("50000000000"),
        fee: 0.001,
      }),
    ];

    router.registerAdapter(createMockAdapter("soroswap", soroswapPools));
    router.registerAdapter(createMockAdapter("phoenix", phoenixPools));

    const route = await router.findBestRoute("XLM", "USDC", BigInt("10000"));
    expect(route).not.toBeNull();
    expect(route!.path[0].pool.dex).toBe("phoenix");
  });

  it("should respect maxHops parameter", async () => {
    const pools = [
      makePool({ id: "p1", tokenA: "A", tokenB: "B", dex: "soroswap", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
      makePool({ id: "p2", tokenA: "B", tokenB: "C", dex: "soroswap", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
      makePool({ id: "p3", tokenA: "C", tokenB: "D", dex: "soroswap", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
    ];
    router.registerAdapter(createMockAdapter("soroswap", pools));

    const route = await router.findBestRoute("A", "D", BigInt("1000000"), 1);
    expect(route).toBeNull();
  });
});
