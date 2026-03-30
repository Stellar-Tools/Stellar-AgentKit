// tests/unit/router/types.test.ts
import { describe, it, expect } from "vitest";
import type {
  DexAdapter,
  Pool,
  Quote,
  Route,
  RouteLeg,
  SwapParams,
  SwapResult,
  NetworkConfig,
} from "../../router/types";

describe("Router Types", () => {
  it("should create a valid Pool object", () => {
    const pool: Pool = {
      id: "soroswap:XLMUSDC",
      dex: "soroswap",
      tokenA: "native",
      tokenB: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      reserveA: BigInt("1000000000"),
      reserveB: BigInt("500000000"),
      fee: 0.003,
      contractAddress: "CABC123",
      lastUpdated: Date.now(),
    };
    expect(pool.dex).toBe("soroswap");
    expect(pool.fee).toBe(0.003);
    expect(typeof pool.reserveA).toBe("bigint");
  });

  it("should create a valid Quote object", () => {
    const quote: Quote = {
      amountOut: BigInt("990000"),
      priceImpact: 0.5,
      fee: BigInt("3000"),
    };
    expect(quote.amountOut).toBe(BigInt("990000"));
    expect(quote.priceImpact).toBe(0.5);
  });

  it("should create a valid Route with legs", () => {
    const pool: Pool = {
      id: "soroswap:XLMUSDC",
      dex: "soroswap",
      tokenA: "native",
      tokenB: "CUSDC",
      reserveA: BigInt("1000000000"),
      reserveB: BigInt("500000000"),
      fee: 0.003,
      lastUpdated: Date.now(),
    };
    const leg: RouteLeg = {
      pool,
      tokenIn: "native",
      tokenOut: "CUSDC",
      amountIn: BigInt("1000000"),
      expectedAmountOut: BigInt("490000"),
    };
    const route: Route = {
      path: [leg],
      totalAmountOut: BigInt("490000"),
      totalPriceImpact: 0.5,
      totalFees: BigInt("3000"),
    };
    expect(route.path).toHaveLength(1);
    expect(route.totalAmountOut).toBe(BigInt("490000"));
  });

  it("should create valid SwapParams with strategy", () => {
    const params: SwapParams = {
      tokenIn: "native",
      tokenOut: "CUSDC",
      amount: "1000000",
      slippage: 0.5,
      strategy: "best-route",
      maxHops: 3,
    };
    expect(params.strategy).toBe("best-route");
    expect(params.maxHops).toBe(3);
  });

  it("should create valid SwapResult", () => {
    const result: SwapResult = {
      txHash: "abc123",
      route: {
        path: ["native", "CUSDC"],
        dexes: ["soroswap"],
        amountIn: "1000000",
        amountOut: "490000",
        priceImpact: 0.5,
      },
    };
    expect(result.route.dexes).toContain("soroswap");
  });

  it("should create valid NetworkConfig", () => {
    const config: NetworkConfig = {
      rpcUrl: "https://soroban.stellar.org",
      horizonUrl: "https://horizon.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      soroswapFactory: "CABC123",
      phoenixFactory: "CDEF456",
    };
    expect(config.rpcUrl).toContain("stellar.org");
  });
});
