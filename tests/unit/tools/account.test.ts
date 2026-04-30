import { describe, it, expect, vi, beforeEach } from "vitest";
import { StellarAccountTool } from "../../../tools/account";

// Mock all lib/account functions
vi.mock("../../../lib/account", () => ({
  getAccountInfo: vi.fn(),
  getBalances: vi.fn(),
  getTransactionHistory: vi.fn(),
  getOperationHistory: vi.fn(),
  fundTestnetAccount: vi.fn(),
}));

import {
  getAccountInfo,
  getBalances,
  getTransactionHistory,
  getOperationHistory,
  fundTestnetAccount,
} from "../../../lib/account";

const mockedGetAccountInfo = vi.mocked(getAccountInfo);
const mockedGetBalances = vi.mocked(getBalances);
const mockedGetTransactionHistory = vi.mocked(getTransactionHistory);
const mockedGetOperationHistory = vi.mocked(getOperationHistory);
const mockedFundTestnetAccount = vi.mocked(fundTestnetAccount);

describe("StellarAccountTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct name and description", () => {
    expect(StellarAccountTool.name).toBe("stellar_account_tool");
    expect(StellarAccountTool.description).toContain("account");
  });

  it("delegates get_info action to getAccountInfo", async () => {
    const mockInfo = {
      accountId: "GTEST...",
      balances: [],
      sequence: "123",
    };
    mockedGetAccountInfo.mockResolvedValue(mockInfo as any);

    const result = await StellarAccountTool.func({
      action: "get_info",
      publicKey: "GTEST...",
      network: "testnet",
    });

    expect(mockedGetAccountInfo).toHaveBeenCalledWith("GTEST...", {
      network: "testnet",
    });
    expect(result).toContain("GTEST...");
  });

  it("delegates get_balances action to getBalances", async () => {
    mockedGetBalances.mockResolvedValue([
      {
        assetType: "native",
        balance: "100.0000000",
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      },
    ]);

    const result = await StellarAccountTool.func({
      action: "get_balances",
      publicKey: "GTEST...",
      network: "testnet",
    });

    expect(mockedGetBalances).toHaveBeenCalled();
    expect(result).toContain("100.0000000");
  });

  it("returns friendly message when no balances found", async () => {
    mockedGetBalances.mockResolvedValue([]);

    const result = await StellarAccountTool.func({
      action: "get_balances",
      publicKey: "GTEST...",
      network: "testnet",
    });

    expect(result).toContain("No balances found");
  });

  it("delegates get_transactions action with defaults", async () => {
    mockedGetTransactionHistory.mockResolvedValue([]);

    const result = await StellarAccountTool.func({
      action: "get_transactions",
      publicKey: "GTEST...",
      network: "testnet",
    });

    expect(mockedGetTransactionHistory).toHaveBeenCalledWith(
      "GTEST...",
      { network: "testnet" },
      10,
      "desc"
    );
    expect(result).toContain("No transactions found");
  });

  it("delegates get_operations action with custom limit and order", async () => {
    mockedGetOperationHistory.mockResolvedValue([]);

    await StellarAccountTool.func({
      action: "get_operations",
      publicKey: "GTEST...",
      network: "mainnet",
      limit: 25,
      order: "asc",
    });

    expect(mockedGetOperationHistory).toHaveBeenCalledWith(
      "GTEST...",
      { network: "mainnet" },
      25,
      "asc"
    );
  });

  it("delegates fund_testnet action on testnet", async () => {
    mockedFundTestnetAccount.mockResolvedValue({
      success: true,
      message: "Funded!",
    });

    const result = await StellarAccountTool.func({
      action: "fund_testnet",
      publicKey: "GTEST...",
      network: "testnet",
    });

    expect(mockedFundTestnetAccount).toHaveBeenCalledWith("GTEST...");
    expect(result).toContain("Funded!");
  });

  it("rejects fund_testnet action on mainnet", async () => {
    await expect(
      StellarAccountTool.func({
        action: "fund_testnet",
        publicKey: "GTEST...",
        network: "mainnet",
      })
    ).rejects.toThrow("only available on testnet");
  });
});
