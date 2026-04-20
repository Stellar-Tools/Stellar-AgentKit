import { describe, expect, it, vi, beforeEach } from "vitest";
import { RouteOptimizer } from "../../../lib/route";
import * as dex from "../../../lib/dex";

vi.mock("../../../lib/dex", async () => {
  const actual = await vi.importActual("../../../lib/dex") as any;
  return {
    ...actual,
    quoteSwap: vi.fn(),
    swapBestRoute: vi.fn(),
  };
});

describe("RouteOptimizer", () => {
  const dexConfig = {
    network: "testnet" as const,
    horizonUrl: "https://horizon-testnet.stellar.org",
    publicKey: "GA...",
  };
  const sorobanConfig = {
    network: "testnet" as const,
    rpcUrl: "https://soroban-testnet.stellar.org",
  };

  let optimizer: RouteOptimizer;

  beforeEach(() => {
    optimizer = new RouteOptimizer(dexConfig, sorobanConfig);
    vi.clearAllMocks();
  });

  it("finds the best route using Classic DEX as a primary source", async () => {
    const mockQuote = {
      path: [],
      sendAmount: "10",
      destAmount: "12",
      estimatedPrice: "1.2",
      hopCount: 0,
      raw: {} as any,
    };
    (dex.quoteSwap as any).mockResolvedValue([mockQuote]);

    const result = await optimizer.findBestRoute({
      fromAsset: { type: "native" },
      toAsset: { code: "USDC", issuer: "G..." },
      amount: "10",
      mode: "strict-send",
    });

    expect(result.source).toBe("classic");
    expect(result.quote).toEqual(mockQuote);
    expect(dex.quoteSwap).toHaveBeenCalled();
  });

  it("throws error when no routes are found", async () => {
    (dex.quoteSwap as any).mockResolvedValue([]);

    await expect(optimizer.findBestRoute({
      fromAsset: { type: "native" },
      toAsset: { code: "USDC", issuer: "G..." },
      amount: "10",
      mode: "strict-send",
    })).rejects.toThrow("No routes found");
  });
});
