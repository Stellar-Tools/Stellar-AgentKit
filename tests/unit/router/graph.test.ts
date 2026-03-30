import { describe, it, expect } from "vitest";
import { TokenGraph } from "../../../router/graph";
import type { Pool } from "../../../router/types";

function makePool(overrides: Partial<Pool> & Pick<Pool, "id" | "tokenA" | "tokenB">): Pool {
  return {
    dex: "soroswap",
    reserveA: BigInt("1000000000"),
    reserveB: BigInt("500000000"),
    fee: 0.003,
    lastUpdated: Date.now(),
    ...overrides,
  };
}

describe("TokenGraph", () => {
  describe("buildFromPools", () => {
    it("should create edges for each pool in both directions", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC" }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const tokens = graph.getTokens();
      expect(tokens).toContain("XLM");
      expect(tokens).toContain("USDC");
    });

    it("should handle multiple pools between different tokens", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC" }),
        makePool({ id: "p2", tokenA: "USDC", tokenB: "ETH" }),
        makePool({ id: "p3", tokenA: "XLM", tokenB: "ETH" }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      expect(graph.getTokens()).toHaveLength(3);
    });

    it("should handle duplicate pools between same tokens from different DEXes", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC", dex: "soroswap", fee: 0.003 }),
        makePool({ id: "p2", tokenA: "XLM", tokenB: "USDC", dex: "phoenix", fee: 0.001 }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const edges = graph.getEdges("XLM", "USDC");
      expect(edges).toHaveLength(2);
    });
  });

  describe("findBestRoute", () => {
    it("should find a direct route when one exists", () => {
      const pools: Pool[] = [
        makePool({
          id: "p1",
          tokenA: "XLM",
          tokenB: "USDC",
          reserveA: BigInt("10000000000"),
          reserveB: BigInt("5000000000"),
        }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("XLM", "USDC", BigInt("1000000"), 3);
      expect(route).not.toBeNull();
      expect(route!.path).toHaveLength(1);
      expect(route!.path[0].tokenIn).toBe("XLM");
      expect(route!.path[0].tokenOut).toBe("USDC");
      expect(route!.totalAmountOut).toBeGreaterThan(BigInt(0));
    });

    it("should find a multi-hop route", () => {
      const pools: Pool[] = [
        makePool({
          id: "p1",
          tokenA: "XLM",
          tokenB: "USDC",
          reserveA: BigInt("10000000000"),
          reserveB: BigInt("5000000000"),
        }),
        makePool({
          id: "p2",
          tokenA: "USDC",
          tokenB: "ETH",
          reserveA: BigInt("5000000000"),
          reserveB: BigInt("2500000000"),
        }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("XLM", "ETH", BigInt("1000000"), 3);
      expect(route).not.toBeNull();
      expect(route!.path).toHaveLength(2);
      expect(route!.path[0].tokenOut).toBe("USDC");
      expect(route!.path[1].tokenOut).toBe("ETH");
    });

    it("should return null when no route exists", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC" }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("XLM", "BTC", BigInt("1000000"), 3);
      expect(route).toBeNull();
    });

    it("should respect maxHops limit", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "A", tokenB: "B", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
        makePool({ id: "p2", tokenA: "B", tokenB: "C", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
        makePool({ id: "p3", tokenA: "C", tokenB: "D", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
        makePool({ id: "p4", tokenA: "D", tokenB: "E", reserveA: BigInt("10000000000"), reserveB: BigInt("10000000000") }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("A", "E", BigInt("1000000"), 2);
      expect(route).toBeNull();
    });

    it("should choose the better rate between two routes", () => {
      const pools: Pool[] = [
        makePool({
          id: "p1",
          tokenA: "XLM",
          tokenB: "ETH",
          reserveA: BigInt("100000"),
          reserveB: BigInt("50000"),
          dex: "soroswap",
        }),
        makePool({
          id: "p2",
          tokenA: "XLM",
          tokenB: "USDC",
          reserveA: BigInt("100000000000"),
          reserveB: BigInt("50000000000"),
          dex: "soroswap",
        }),
        makePool({
          id: "p3",
          tokenA: "USDC",
          tokenB: "ETH",
          reserveA: BigInt("50000000000"),
          reserveB: BigInt("25000000000"),
          dex: "phoenix",
        }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("XLM", "ETH", BigInt("10000"), 3);
      expect(route).not.toBeNull();
      expect(route!.path.length).toBeGreaterThanOrEqual(1);
      expect(route!.totalAmountOut).toBeGreaterThan(BigInt(0));
    });

    it("should prevent routing back to same token (no cycles)", () => {
      const pools: Pool[] = [
        makePool({ id: "p1", tokenA: "XLM", tokenB: "USDC", reserveA: BigInt("10000000000"), reserveB: BigInt("5000000000") }),
        makePool({ id: "p2", tokenA: "USDC", tokenB: "XLM", reserveA: BigInt("5000000000"), reserveB: BigInt("10000000000") }),
        makePool({ id: "p3", tokenA: "XLM", tokenB: "ETH", reserveA: BigInt("10000000000"), reserveB: BigInt("5000000000") }),
      ];
      const graph = new TokenGraph();
      graph.buildFromPools(pools);
      const route = graph.findBestRoute("XLM", "ETH", BigInt("1000000"), 3);
      expect(route).not.toBeNull();
      const visitedTokens = route!.path.map((leg) => leg.tokenIn);
      const uniqueTokens = new Set(visitedTokens);
      expect(uniqueTokens.size).toBe(visitedTokens.length);
    });
  });
});
