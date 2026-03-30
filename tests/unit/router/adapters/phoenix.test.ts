import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhoenixAdapter } from "../../../../router/adapters/phoenix";
import type { Pool, NetworkConfig } from "../../../../router/types";

const testConfig: NetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  soroswapFactory: "CFACTORY",
  phoenixFactory: "CPHOENIX",
};

describe("PhoenixAdapter", () => {
  let adapter: PhoenixAdapter;

  beforeEach(() => {
    adapter = new PhoenixAdapter(testConfig);
  });

  it("should have the correct name", () => {
    expect(adapter.name).toBe("phoenix");
  });

  it("should implement DexAdapter interface", () => {
    expect(typeof adapter.discoverPools).toBe("function");
    expect(typeof adapter.getQuote).toBe("function");
    expect(typeof adapter.buildSwapOp).toBe("function");
  });

  it("should compute quote using constant product formula", async () => {
    const pool: Pool = {
      id: "phoenix:test",
      dex: "phoenix",
      tokenA: "XLM",
      tokenB: "USDC",
      reserveA: BigInt("10000000000"),
      reserveB: BigInt("5000000000"),
      fee: 0.003,
      lastUpdated: Date.now(),
      contractAddress: "CPHOENIXPOOL",
    };

    const quote = await adapter.getQuote(pool, "XLM", BigInt("1000000"));
    expect(quote.amountOut).toBeGreaterThan(BigInt(0));
    expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
    expect(quote.fee).toBeGreaterThan(BigInt(0));
  });
});
