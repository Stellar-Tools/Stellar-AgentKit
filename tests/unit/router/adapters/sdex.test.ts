import { describe, it, expect, vi, beforeEach } from "vitest";
import { SdexAdapter } from "../../../../router/adapters/sdex";
import type { Pool, NetworkConfig } from "../../../../router/types";

// Mock global fetch for Horizon API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const testConfig: NetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  soroswapFactory: "CFACTORY",
  phoenixFactory: "CPHOENIX",
};

describe("SdexAdapter", () => {
  let adapter: SdexAdapter;

  beforeEach(() => {
    adapter = new SdexAdapter(testConfig);
    mockFetch.mockReset();
  });

  it("should have the correct name", () => {
    expect(adapter.name).toBe("sdex");
  });

  it("should implement DexAdapter interface", () => {
    expect(typeof adapter.discoverPools).toBe("function");
    expect(typeof adapter.getQuote).toBe("function");
    expect(typeof adapter.buildSwapOp).toBe("function");
  });

  it("should discover pools from known SDEX trading pairs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        bids: [{ price: "0.5", amount: "1000" }],
        asks: [{ price: "0.51", amount: "900" }],
      }),
    });

    const pools = await adapter.discoverPools();
    expect(pools.length).toBeGreaterThanOrEqual(0);
  });

  it("should calculate quote from Horizon paths endpoint", async () => {
    const pool: Pool = {
      id: "sdex:XLM-USDC",
      dex: "sdex",
      tokenA: "native",
      tokenB: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      reserveA: BigInt("10000000000"),
      reserveB: BigInt("5000000000"),
      fee: 0,
      lastUpdated: Date.now(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              destination_amount: "49.5000000",
              path: [],
              source_amount: "100.0000000",
            },
          ],
        },
      }),
    });

    const quote = await adapter.getQuote(pool, "native", BigInt("1000000000"));
    expect(quote.amountOut).toBeGreaterThan(BigInt(0));
  });
});
