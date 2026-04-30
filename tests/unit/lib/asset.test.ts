import { describe, it, expect, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  getAssetDetails,
  getOrderbook,
  getTrades,
} from "../../../lib/asset";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const issuerKey = Keypair.random().publicKey();

const mockAssetRecords = [
  {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: issuerKey,
    paging_token: "USDC_" + issuerKey,
    num_accounts: 5000,
    amount: "15000000.0000000",
    flags: {
      auth_required: true,
      auth_revocable: true,
      auth_immutable: false,
      auth_clawback_enabled: true,
    },
  },
];

const mockOrderbookResponse = {
  base: { asset_type: "native" },
  counter: {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: issuerKey,
  },
  bids: [
    { price: "0.1200000", amount: "5000.0000000", price_r: { n: 3, d: 25 } },
    { price: "0.1150000", amount: "8000.0000000", price_r: { n: 23, d: 200 } },
  ],
  asks: [
    { price: "0.1250000", amount: "3000.0000000", price_r: { n: 1, d: 8 } },
  ],
};

const mockTradeRecords = [
  {
    id: "trade-1",
    paging_token: "pt-1",
    ledger_close_time: "2026-04-30T12:00:00Z",
    base_account: Keypair.random().publicKey(),
    base_amount: "100.0000000",
    base_asset_type: "native",
    counter_account: Keypair.random().publicKey(),
    counter_amount: "12.5000000",
    counter_asset_type: "credit_alphanum4",
    counter_asset_code: "USDC",
    counter_asset_issuer: issuerKey,
    price: { n: "1", d: "8" },
    base_is_seller: true,
  },
];

// ─── Mock Server Factory ────────────────────────────────────────────────────

function makeMockServer(overrides: Partial<Record<string, any>> = {}) {
  return () => ({
    assets: vi.fn().mockReturnValue({
      forCode: vi.fn().mockReturnValue({
        forIssuer: vi.fn().mockReturnValue({
          call: overrides.assetsCall ?? vi.fn(),
        }),
      }),
    }),
    orderbook: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        call: overrides.orderbookCall ?? vi.fn(),
      }),
    }),
    trades: vi.fn().mockReturnValue({
      forAssetPair: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            call: overrides.tradesCall ?? vi.fn(),
          }),
        }),
      }),
    }),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("lib/asset", () => {
  // ── getAssetDetails ─────────────────────────────────────────────────────

  describe("getAssetDetails", () => {
    it("returns asset details for a valid asset", async () => {
      const assetsCall = vi.fn().mockResolvedValue({ records: mockAssetRecords });
      const deps = { createServer: makeMockServer({ assetsCall }) };

      const details = await getAssetDetails("USDC", issuerKey, { network: "testnet" }, deps);

      expect(details).toHaveLength(1);
      expect(details[0].assetCode).toBe("USDC");
      expect(details[0].assetIssuer).toBe(issuerKey);
      expect(details[0].numAccounts).toBe(5000);
      expect(details[0].amount).toBe("15000000.0000000");
    });

    it("correctly maps issuer flags", async () => {
      const assetsCall = vi.fn().mockResolvedValue({ records: mockAssetRecords });
      const deps = { createServer: makeMockServer({ assetsCall }) };

      const details = await getAssetDetails("USDC", issuerKey, { network: "testnet" }, deps);

      expect(details[0].flags.authRequired).toBe(true);
      expect(details[0].flags.authRevocable).toBe(true);
      expect(details[0].flags.authImmutable).toBe(false);
      expect(details[0].flags.authClawbackEnabled).toBe(true);
    });

    it("throws when asset is not found", async () => {
      const assetsCall = vi.fn().mockResolvedValue({ records: [] });
      const deps = { createServer: makeMockServer({ assetsCall }) };

      await expect(
        getAssetDetails("FAKE", issuerKey, { network: "testnet" }, deps)
      ).rejects.toThrow("not found on testnet");
    });

    it("validates asset code length", async () => {
      await expect(
        getAssetDetails("", issuerKey, { network: "testnet" })
      ).rejects.toThrow("Asset code must be between 1 and 12 characters");

      await expect(
        getAssetDetails("TOOLONGASSETCODE", issuerKey, { network: "testnet" })
      ).rejects.toThrow("Asset code must be between 1 and 12 characters");
    });

    it("validates asset issuer public key", async () => {
      await expect(
        getAssetDetails("USDC", "invalid-issuer", { network: "testnet" })
      ).rejects.toThrow("Invalid asset issuer public key");
    });
  });

  // ── getOrderbook ────────────────────────────────────────────────────────

  describe("getOrderbook", () => {
    it("returns bids and asks for a trading pair", async () => {
      const orderbookCall = vi.fn().mockResolvedValue(mockOrderbookResponse);
      const deps = { createServer: makeMockServer({ orderbookCall }) };

      const orderbook = await getOrderbook(
        { type: "native" },
        { code: "USDC", issuer: issuerKey },
        { network: "testnet" },
        10,
        deps
      );

      expect(orderbook.base.assetType).toBe("native");
      expect(orderbook.counter.assetCode).toBe("USDC");
      expect(orderbook.bids).toHaveLength(2);
      expect(orderbook.asks).toHaveLength(1);
      expect(orderbook.bids[0].price).toBe("0.1200000");
      expect(orderbook.asks[0].amount).toBe("3000.0000000");
    });

    it("correctly maps price ratio", async () => {
      const orderbookCall = vi.fn().mockResolvedValue(mockOrderbookResponse);
      const deps = { createServer: makeMockServer({ orderbookCall }) };

      const orderbook = await getOrderbook(
        { type: "native" },
        { code: "USDC", issuer: issuerKey },
        { network: "testnet" },
        10,
        deps
      );

      expect(orderbook.bids[0].priceR).toEqual({ n: 3, d: 25 });
    });

    it("validates limit boundaries", async () => {
      await expect(
        getOrderbook(
          { type: "native" },
          { code: "USDC", issuer: issuerKey },
          { network: "testnet" },
          0
        )
      ).rejects.toThrow("Orderbook limit must be between 1 and 200");

      await expect(
        getOrderbook(
          { type: "native" },
          { code: "USDC", issuer: issuerKey },
          { network: "testnet" },
          300
        )
      ).rejects.toThrow("Orderbook limit must be between 1 and 200");
    });
  });

  // ── getTrades ───────────────────────────────────────────────────────────

  describe("getTrades", () => {
    it("returns recent trades for a trading pair", async () => {
      const tradesCall = vi.fn().mockResolvedValue({ records: mockTradeRecords });
      const deps = { createServer: makeMockServer({ tradesCall }) };

      const trades = await getTrades(
        { type: "native" },
        { code: "USDC", issuer: issuerKey },
        { network: "testnet" },
        10,
        "desc",
        deps
      );

      expect(trades).toHaveLength(1);
      expect(trades[0].baseAmount).toBe("100.0000000");
      expect(trades[0].counterAssetCode).toBe("USDC");
      expect(trades[0].baseIsSeller).toBe(true);
      expect(trades[0].price).toEqual({ n: "1", d: "8" });
    });

    it("validates limit boundaries", async () => {
      await expect(
        getTrades(
          { type: "native" },
          { code: "USDC", issuer: issuerKey },
          { network: "testnet" },
          0
        )
      ).rejects.toThrow("Trades limit must be between 1 and 50");

      await expect(
        getTrades(
          { type: "native" },
          { code: "USDC", issuer: issuerKey },
          { network: "testnet" },
          100
        )
      ).rejects.toThrow("Trades limit must be between 1 and 50");
    });
  });
});
