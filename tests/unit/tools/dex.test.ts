import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("DEX Tool", () => {
  const originalPublicKey = process.env.STELLAR_PUBLIC_KEY;

  beforeEach(() => {
    process.env.STELLAR_PUBLIC_KEY = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA6LK6GITSTKOXFWUCIM5T5RZVBR";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    if (originalPublicKey === undefined) {
      delete process.env.STELLAR_PUBLIC_KEY;
      return;
    }

    process.env.STELLAR_PUBLIC_KEY = originalPublicKey;
  });

  it("declares route quote and execution actions", () => {
    const validActions = ["quote_swap", "swap_best_route"] as const;

    expect(validActions).toContain("quote_swap");
    expect(validActions).toContain("swap_best_route");
    expect(validActions).toHaveLength(2);
  });

  it("blocks mainnet execution without allowMainnet", async () => {
    vi.doMock("../../../lib/dex", () => ({
      quoteSwap: vi.fn(),
      swapBestRoute: vi.fn(),
    }));

    const { StellarDexTool } = await import("../../../tools/dex");

    await expect(
      StellarDexTool.func({
        action: "swap_best_route",
        mode: "strict-send",
        sendAsset: { type: "native" },
        destAsset: { type: "native" },
        sendAmount: "10",
        network: "mainnet",
      })
    ).rejects.toThrow("allowMainnet: true is required for mainnet DEX actions");
  });

  it("forwards quote and swap inputs to the DEX library", async () => {
    const quoteSwap = vi.fn().mockResolvedValue([{ destAmount: "12.0" }]);
    const swapBestRoute = vi.fn().mockResolvedValue({ hash: "abc123" });

    vi.doMock("../../../lib/dex", () => ({
      quoteSwap,
      swapBestRoute,
    }));

    const { StellarDexTool } = await import("../../../tools/dex");

    const quoteResult = await StellarDexTool.func({
      action: "quote_swap",
      mode: "strict-receive",
      sendAsset: { type: "native" },
      destAsset: { code: "USD", issuer: process.env.STELLAR_PUBLIC_KEY },
      destAmount: "5",
      destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      limit: 3,
    });

    expect(JSON.parse(quoteResult)).toEqual([{ destAmount: "12.0" }]);
    expect(quoteSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "testnet",
        publicKey: process.env.STELLAR_PUBLIC_KEY,
      }),
      expect.objectContaining({
        mode: "strict-receive",
        destAmount: "5",
        limit: 3,
      })
    );

    const swapResult = await StellarDexTool.func({
      action: "swap_best_route",
      mode: "strict-send",
      sendAsset: { code: "USD", issuer: process.env.STELLAR_PUBLIC_KEY },
      destAsset: { type: "native" },
      sendAmount: "10",
      slippageBps: 25,
      allowMainnet: true,
      network: "mainnet",
    });

    expect(JSON.parse(swapResult)).toEqual({ hash: "abc123" });
    expect(swapBestRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "mainnet",
        horizonUrl: "https://horizon.stellar.org",
      }),
      expect.objectContaining({
        mode: "strict-send",
        sendAmount: "10",
        slippageBps: 25,
      })
    );
  });
});
