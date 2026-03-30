import { describe, it, expect, vi, beforeEach } from "vitest";
import { SoroswapAdapter } from "../../../../router/adapters/soroswap";
import type { Pool, NetworkConfig } from "../../../../router/types";

const testConfig: NetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  soroswapFactory: "CFACTORY",
  phoenixFactory: "CPHOENIX",
};

describe("SoroswapAdapter", () => {
  let adapter: SoroswapAdapter;

  beforeEach(() => {
    adapter = new SoroswapAdapter(testConfig);
  });

  it("should have the correct name", () => {
    expect(adapter.name).toBe("soroswap");
  });

  it("should implement DexAdapter interface", () => {
    expect(typeof adapter.discoverPools).toBe("function");
    expect(typeof adapter.getQuote).toBe("function");
    expect(typeof adapter.buildSwapOp).toBe("function");
  });

  it("should calculate correct quote for a pool", async () => {
    const pool: Pool = {
      id: "test",
      dex: "soroswap",
      tokenA: "XLM",
      tokenB: "USDC",
      reserveA: BigInt("10000000000"),
      reserveB: BigInt("5000000000"),
      fee: 0.003,
      lastUpdated: Date.now(),
    };
    // getQuote uses the constant product formula locally, no network needed
    const quote = await adapter.getQuote(pool, "XLM", BigInt("1000000"));
    expect(quote.amountOut).toBeGreaterThan(BigInt(0));
    expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
    expect(quote.fee).toBeGreaterThan(BigInt(0));
  });
});
