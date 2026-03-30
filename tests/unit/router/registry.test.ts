import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoolRegistry } from "../../../router/registry";
import type { DexAdapter, Pool, Quote } from "../../../router/types";
import { xdr } from "@stellar/stellar-sdk";

function createMockAdapter(name: string, pools: Pool[]): DexAdapter {
  return {
    name,
    discoverPools: vi.fn().mockResolvedValue(pools),
    getQuote: vi.fn().mockResolvedValue({
      amountOut: BigInt("990000"),
      priceImpact: 0.1,
      fee: BigInt("3000"),
    } as Quote),
    buildSwapOp: vi.fn().mockResolvedValue({} as xdr.Operation),
  };
}

function makePool(id: string, dex: string): Pool {
  return {
    id,
    dex,
    tokenA: "native",
    tokenB: "CUSDC",
    reserveA: BigInt("1000000000"),
    reserveB: BigInt("500000000"),
    fee: 0.003,
    lastUpdated: Date.now(),
  };
}

describe("PoolRegistry", () => {
  let registry: PoolRegistry;

  beforeEach(() => {
    registry = new PoolRegistry({ refreshIntervalMs: 300000 });
  });

  it("should register adapters", () => {
    const adapter = createMockAdapter("soroswap", []);
    registry.registerAdapter(adapter);
    expect(registry.getAdapterNames()).toContain("soroswap");
  });

  it("should discover pools from all adapters", async () => {
    const pool1 = makePool("p1", "soroswap");
    const pool2 = makePool("p2", "phoenix");
    registry.registerAdapter(createMockAdapter("soroswap", [pool1]));
    registry.registerAdapter(createMockAdapter("phoenix", [pool2]));

    const pools = await registry.getPools();
    expect(pools).toHaveLength(2);
    expect(pools.map((p) => p.id)).toContain("p1");
    expect(pools.map((p) => p.id)).toContain("p2");
  });

  it("should return cached pools on second call within interval", async () => {
    const adapter = createMockAdapter("soroswap", [makePool("p1", "soroswap")]);
    registry.registerAdapter(adapter);

    await registry.getPools();
    await registry.getPools();
    expect(adapter.discoverPools).toHaveBeenCalledTimes(1);
  });

  it("should refresh pools after interval expires", async () => {
    const registry = new PoolRegistry({ refreshIntervalMs: 0 });
    const adapter = createMockAdapter("soroswap", [makePool("p1", "soroswap")]);
    registry.registerAdapter(adapter);

    await registry.getPools();
    await new Promise((r) => setTimeout(r, 1));
    await registry.getPools();
    expect(adapter.discoverPools).toHaveBeenCalledTimes(2);
  });

  it("should clear cache on clearCache()", async () => {
    const adapter = createMockAdapter("soroswap", [makePool("p1", "soroswap")]);
    registry.registerAdapter(adapter);

    await registry.getPools();
    registry.clearCache();
    await registry.getPools();
    expect(adapter.discoverPools).toHaveBeenCalledTimes(2);
  });

  it("should continue if one adapter fails during discovery", async () => {
    const failingAdapter: DexAdapter = {
      name: "broken",
      discoverPools: vi.fn().mockRejectedValue(new Error("network error")),
      getQuote: vi.fn(),
      buildSwapOp: vi.fn(),
    };
    const goodAdapter = createMockAdapter("soroswap", [makePool("p1", "soroswap")]);

    registry.registerAdapter(failingAdapter);
    registry.registerAdapter(goodAdapter);

    const pools = await registry.getPools();
    expect(pools).toHaveLength(1);
    expect(pools[0].id).toBe("p1");
  });

  it("should get adapter by name", () => {
    const adapter = createMockAdapter("soroswap", []);
    registry.registerAdapter(adapter);
    expect(registry.getAdapter("soroswap")).toBe(adapter);
    expect(registry.getAdapter("nonexistent")).toBeUndefined();
  });
});
