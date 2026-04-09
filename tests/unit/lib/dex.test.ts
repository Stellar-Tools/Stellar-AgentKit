import { describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  assetInputToSdkAsset,
  calculateSwapBounds,
  quoteSwap,
  rankRouteQuotes,
  type HorizonPathRecord,
} from "../../../lib/dex";

const issuerA = Keypair.random().publicKey();
const issuerB = Keypair.random().publicKey();
const sourcePublicKey = Keypair.random().publicKey();

function createRecord(
  overrides: Partial<HorizonPathRecord> = {}
): HorizonPathRecord {
  return {
    source_asset_type: "credit_alphanum4",
    source_asset_code: "USD",
    source_asset_issuer: issuerA,
    source_amount: "10.0000000",
    destination_asset_type: "credit_alphanum4",
    destination_asset_code: "EUR",
    destination_asset_issuer: issuerB,
    destination_amount: "11.0000000",
    path: [],
    ...overrides,
  };
}

describe("dex helpers", () => {
  it("parses native and issued assets", () => {
    const nativeAsset = assetInputToSdkAsset({ type: "native" });
    const issuedAsset = assetInputToSdkAsset({ code: "USD", issuer: issuerA });

    expect(nativeAsset.getCode()).toBe("XLM");
    expect(issuedAsset.getCode()).toBe("USD");
    expect(issuedAsset.getIssuer()).toBe(issuerA);
  });

  it("ranks strict-send quotes by highest destination amount then shortest path", () => {
    const quotes = [
      {
        path: [{ type: "native" as const }, { code: "EUR", issuer: issuerB }],
        sendAmount: "10",
        destAmount: "11",
        estimatedPrice: "1.1",
        hopCount: 2,
        raw: createRecord({ destination_amount: "11.0000000", path: [{ asset_type: "native" }, { asset_type: "credit_alphanum4", asset_code: "EUR", asset_issuer: issuerB }] }),
      },
      {
        path: [{ type: "native" as const }],
        sendAmount: "10",
        destAmount: "11",
        estimatedPrice: "1.1",
        hopCount: 1,
        raw: createRecord({ destination_amount: "11.0000000", path: [{ asset_type: "native" }] }),
      },
      {
        path: [],
        sendAmount: "10",
        destAmount: "10.5",
        estimatedPrice: "1.05",
        hopCount: 0,
        raw: createRecord({ destination_amount: "10.5000000" }),
      },
    ];

    const ranked = rankRouteQuotes(quotes, "strict-send");

    expect(ranked[0].hopCount).toBe(1);
    expect(ranked[1].hopCount).toBe(2);
    expect(ranked[2].destAmount).toBe("10.5");
  });

  it("ranks strict-receive quotes by lowest source amount then shortest path", () => {
    const quotes = [
      {
        path: [{ type: "native" as const }, { code: "BTC", issuer: issuerA }],
        sendAmount: "11",
        destAmount: "10",
        estimatedPrice: "0.9090909",
        hopCount: 2,
        raw: createRecord({ source_amount: "11.0000000", destination_amount: "10.0000000" }),
      },
      {
        path: [],
        sendAmount: "10.5",
        destAmount: "10",
        estimatedPrice: "0.952381",
        hopCount: 0,
        raw: createRecord({ source_amount: "10.5000000", destination_amount: "10.0000000" }),
      },
      {
        path: [{ type: "native" as const }],
        sendAmount: "10.5",
        destAmount: "10",
        estimatedPrice: "0.952381",
        hopCount: 1,
        raw: createRecord({ source_amount: "10.5000000", destination_amount: "10.0000000", path: [{ asset_type: "native" }] }),
      },
    ];

    const ranked = rankRouteQuotes(quotes, "strict-receive");

    expect(ranked[0].hopCount).toBe(0);
    expect(ranked[1].hopCount).toBe(1);
    expect(ranked[2].sendAmount).toBe("11");
  });

  it("derives slippage bounds for both route modes", () => {
    const quote = {
      path: [],
      sendAmount: "10",
      destAmount: "12",
      estimatedPrice: "1.2",
      hopCount: 0,
      raw: createRecord({ source_amount: "10.0000000", destination_amount: "12.0000000" }),
    };

    expect(calculateSwapBounds(quote, "strict-send", 100)).toEqual({
      destMin: "11.88",
    });
    expect(calculateSwapBounds(quote, "strict-receive", 100)).toEqual({
      sendMax: "10.1",
    });
  });

  it("quotes and filters route candidates from Horizon responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "EUR",
              asset_issuer: issuerB,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: {
            records: [
              createRecord({
                destination_amount: "11.5000000",
                path: [{ asset_type: "native" }],
              }),
              createRecord({
                destination_amount: "11.6000000",
                path: [],
              }),
            ],
          },
        }),
      });

    const quotes = await quoteSwap(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: sourcePublicKey,
      },
      {
        mode: "strict-send",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        sendAmount: "10.0000000",
      },
      { fetchImpl }
    );

    expect(quotes).toHaveLength(2);
    expect(quotes[0].destAmount).toBe("11.6000000");

    const requestUrl = fetchImpl.mock.calls[1][0].toString();
    expect(requestUrl).toContain("/paths/strict-send");
    expect(requestUrl).toContain(`destination_assets=EUR%3A${issuerB}`);
  });

  it("finds strict-send routes even when the recipient holds multiple assets", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "EUR",
              asset_issuer: issuerB,
            },
            {
              asset_type: "credit_alphanum4",
              asset_code: "JPY",
              asset_issuer: issuerA,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: {
            records: [
              createRecord({
                destination_amount: "11.7000000",
                path: [],
              }),
            ],
          },
        }),
      });

    const quotes = await quoteSwap(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: sourcePublicKey,
      },
      {
        mode: "strict-send",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        sendAmount: "10.0000000",
      },
      { fetchImpl }
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0].destAmount).toBe("11.7000000");
    expect(fetchImpl.mock.calls[1][0].toString()).toContain(
      `destination_assets=EUR%3A${issuerB}`
    );
  });

  it("honors the public quote limit while using a fixed internal fetch window", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "EUR",
              asset_issuer: issuerB,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: {
            records: [
              createRecord({ destination_amount: "11.9000000" }),
              createRecord({ destination_amount: "11.8000000", path: [{ asset_type: "native" }] }),
              createRecord({ destination_amount: "11.7000000", path: [{ asset_type: "native" }, { asset_type: "native" }] }),
            ],
          },
        }),
      });

    const quotes = await quoteSwap(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: sourcePublicKey,
      },
      {
        mode: "strict-send",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        sendAmount: "10.0000000",
        limit: 2,
      },
      { fetchImpl }
    );

    expect(quotes).toHaveLength(2);
    expect(fetchImpl.mock.calls[1][0].toString()).toContain("limit=20");
  });

  it("uses strict-receive path discovery with source_account and destination asset params", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            {
              asset_type: "credit_alphanum4",
              asset_code: "EUR",
              asset_issuer: issuerB,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: {
            records: [
              createRecord({
                source_amount: "9.5000000",
                destination_amount: "10.0000000",
                path: [{ asset_type: "native" }],
              }),
            ],
          },
        }),
      });

    const quotes = await quoteSwap(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: sourcePublicKey,
      },
      {
        mode: "strict-receive",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        destAmount: "10.0000000",
      },
      { fetchImpl }
    );

    expect(quotes).toHaveLength(1);
    const requestUrl = fetchImpl.mock.calls[1][0].toString();
    expect(requestUrl).toContain("/paths/strict-receive");
    expect(requestUrl).toContain(`source_account=${sourcePublicKey}`);
    expect(requestUrl).toContain(`destination_asset_code=EUR`);
  });

  it("rejects quotes when the destination account does not trust the destination asset", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "JPY",
            asset_issuer: issuerA,
          },
        ],
      }),
    });

    await expect(
      quoteSwap(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: sourcePublicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          sendAmount: "10.0000000",
        },
        { fetchImpl }
      )
    ).rejects.toThrow("Destination account does not trust the requested destination asset");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips destination account asset validation for native destination assets", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              source_asset_type: "credit_alphanum4",
              source_asset_code: "USD",
              source_asset_issuer: issuerA,
              source_amount: "10.0000000",
              destination_asset_type: "native",
              destination_amount: "24.5000000",
              path: [],
            },
          ],
        },
      }),
    });

    const quotes = await quoteSwap(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: sourcePublicKey,
      },
      {
        mode: "strict-send",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { type: "native" },
        sendAmount: "10.0000000",
      },
      { fetchImpl }
    );

    expect(quotes).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0].toString()).toContain("destination_assets=native");
  });

  it("rejects invalid quote params early", async () => {
    await expect(
      quoteSwap(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: sourcePublicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
        }
      )
    ).rejects.toThrow("sendAmount is required");

    await expect(
      quoteSwap(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: "invalid",
        },
        {
          mode: "strict-receive",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          destAmount: "10",
        }
      )
    ).rejects.toThrow("Invalid publicKey");

    await expect(
      quoteSwap(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: sourcePublicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          sendAmount: "10",
          limit: 21,
        }
      )
    ).rejects.toThrow("limit must be an integer between 1 and 20");
  });
});
