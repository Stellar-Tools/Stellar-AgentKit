import { describe, it, expect, vi, beforeEach } from "vitest";
import { StellarAssetTool } from "../../../tools/asset";

// Mock all lib/asset functions
vi.mock("../../../lib/asset", () => ({
  getAssetDetails: vi.fn(),
  getOrderbook: vi.fn(),
  getTrades: vi.fn(),
}));

import {
  getAssetDetails,
  getOrderbook,
  getTrades,
} from "../../../lib/asset";

const mockedGetAssetDetails = vi.mocked(getAssetDetails);
const mockedGetOrderbook = vi.mocked(getOrderbook);
const mockedGetTrades = vi.mocked(getTrades);

describe("StellarAssetTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct name and description", () => {
    expect(StellarAssetTool.name).toBe("stellar_asset_tool");
    expect(StellarAssetTool.description).toContain("asset");
  });

  it("delegates get_asset_details action", async () => {
    mockedGetAssetDetails.mockResolvedValue([
      {
        assetType: "credit_alphanum4",
        assetCode: "USDC",
        assetIssuer: "GISSUER...",
        pagingToken: "pt",
        numAccounts: 100,
        amount: "1000000",
        flags: {
          authRequired: false,
          authRevocable: false,
          authImmutable: false,
          authClawbackEnabled: false,
        },
      },
    ]);

    const result = await StellarAssetTool.func({
      action: "get_asset_details",
      assetCode: "USDC",
      assetIssuer: "GISSUER...",
      network: "testnet",
    });

    expect(mockedGetAssetDetails).toHaveBeenCalledWith(
      "USDC",
      "GISSUER...",
      { network: "testnet" }
    );
    expect(result).toContain("USDC");
  });

  it("throws when get_asset_details is missing required params", async () => {
    await expect(
      StellarAssetTool.func({
        action: "get_asset_details",
        network: "testnet",
      })
    ).rejects.toThrow("'assetCode' and 'assetIssuer' are required");
  });

  it("delegates get_orderbook action", async () => {
    mockedGetOrderbook.mockResolvedValue({
      base: { assetType: "native" },
      counter: { assetType: "credit_alphanum4", assetCode: "USDC" },
      bids: [],
      asks: [],
    } as any);

    const result = await StellarAssetTool.func({
      action: "get_orderbook",
      baseAsset: { type: "native" },
      counterAsset: { code: "USDC", issuer: "G..." },
      network: "testnet",
    });

    expect(mockedGetOrderbook).toHaveBeenCalled();
    expect(result).toContain("native");
  });

  it("throws when get_orderbook is missing required params", async () => {
    await expect(
      StellarAssetTool.func({
        action: "get_orderbook",
        network: "testnet",
      })
    ).rejects.toThrow("'baseAsset' and 'counterAsset' are required");
  });

  it("delegates get_trades action", async () => {
    mockedGetTrades.mockResolvedValue([]);

    const result = await StellarAssetTool.func({
      action: "get_trades",
      baseAsset: { type: "native" },
      counterAsset: { code: "USDC", issuer: "G..." },
      network: "testnet",
    });

    expect(mockedGetTrades).toHaveBeenCalled();
    expect(result).toContain("No trades found");
  });

  it("clamps trades limit to max 50", async () => {
    mockedGetTrades.mockResolvedValue([]);

    await StellarAssetTool.func({
      action: "get_trades",
      baseAsset: { type: "native" },
      counterAsset: { code: "USDC", issuer: "G..." },
      network: "testnet",
      limit: 100,
    });

    // The tool should clamp to 50
    expect(mockedGetTrades).toHaveBeenCalledWith(
      { type: "native" },
      { code: "USDC", issuer: "G..." },
      { network: "testnet" },
      50,
      "desc"
    );
  });
});
