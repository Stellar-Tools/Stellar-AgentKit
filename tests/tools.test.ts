jest.mock('../utils/transactionUtils', () => {
  const original = jest.requireActual('../utils/transactionUtils');

  return {
    ...original,
    buildHorizonServer: jest.fn(),
    buildSorobanServer: jest.fn(),
  };
});

import { createGetAccountBalanceTool } from "../tools/getAccountBalance";
import { createPathPaymentStrictSendTool } from "../tools/pathPaymentStrictSend";
import { createInvokeContractTool } from "../tools/invokeContract";
import { buildHorizonServer, buildSorobanServer } from '../utils/transactionUtils';
import {
  classifyStellarError,
  withRetry,
  estimateFee,
} from "../utils/transactionUtils";

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");

  const mockAccount = {
    balances: [
      {
        asset_type: "native",
        balance: "100.5000000",
        buying_liabilities: "0.0000000",
        selling_liabilities: "0.0000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "TEST_SECRET_DO_NOT_USE",
        balance: "50.0000000",
        limit: "922337203685.4775807",
        buying_liabilities: "0.0000000",
        selling_liabilities: "0.0000000",
      },
    ],
  };

  const mockServer = {
    loadAccount: jest.fn().mockResolvedValue(mockAccount),
    feeStats: jest.fn().mockResolvedValue({
      fee_charged: { p50: "100", p90: "150", p99: "200" },
    }),
    submitTransaction: jest.fn().mockResolvedValue({
      hash: "TEST_SECRET_DO_NOT_USE",
      ledger: 12345,
    }),
    strictSendPaths: jest.fn().mockReturnValue({
      call: jest.fn().mockResolvedValue({ records: [] }),
    }),
  };

  const mockRpcServer = {
    simulateTransaction: jest.fn().mockResolvedValue({
      result: {
        retval: actual.xdr.ScVal.scvBool(true),
      },
      minResourceFee: "500",
    }),
    prepareTransaction: jest.fn().mockResolvedValue({
      sign: jest.fn(),
      toXDR: jest.fn().mockReturnValue("base64encodedtx"),
    }),
    sendTransaction: jest.fn().mockResolvedValue({
      hash: "txhash1234",
      status: "PENDING",
    }),
    getTransaction: jest.fn().mockResolvedValue({
      status: "SUCCESS",
      ledger: 99999,
      returnValue: actual.xdr.ScVal.scvBool(true),
    }),
  };

  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => mockServer),
    },
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: jest.fn().mockImplementation(() => mockRpcServer),
      Api: {
        ...actual.SorobanRpc?.Api,
        isSimulationError: jest.fn().mockReturnValue(false),
        isSimulationSuccess: jest.fn().mockReturnValue(true),
        GetTransactionStatus: { NOT_FOUND: "NOT_FOUND", SUCCESS: "SUCCESS" },
      },
    },
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => "TEST_SECRET_DO_NOT_USE",
        sign: jest.fn(),
      }),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      addMemo: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        sign: jest.fn(),
        toXDR: jest.fn().mockReturnValue("base64"),
      }),
    })),
  };
});

beforeEach(() => {
  (buildHorizonServer as jest.Mock).mockReturnValue({
    feeStats: jest.fn().mockResolvedValue({
      fee_charged: { p50: "100", p90: "200", p99: "300" },
    }),
    loadAccount: jest.fn().mockResolvedValue({
      accountId: "mock_account",
      balances: [
        {
          asset_type: "native",
          balance: "100.0000000",
        },
      ],
    }),
    submitTransaction: jest.fn().mockResolvedValue({
      hash: "mock_tx_hash",
    }),
    strictSendPaths: jest.fn().mockReturnValue({
      call: jest.fn().mockResolvedValue({
        records: [{ destination_amount: "9.5" }],
      }),
    }),
  });

  (buildSorobanServer as jest.Mock).mockReturnValue({
    simulateTransaction: jest.fn().mockResolvedValue({
      result: {
        retval: true,
      },
      minResourceFee: "500",
    }),
  });
});

// GetAccountBalance Tests
describe("createGetAccountBalanceTool", () => {
  const tool = createGetAccountBalanceTool();

  it("should have the correct name and description", () => {
    expect(tool.name).toBe("get_account_balance");
    expect(tool.description).toContain("balance sheet");
  });

  it("should return balances for a valid account", async () => {
    const result = await tool.func({
      accountId: "TEST_SECRET_DO_NOT_USE",
      network: "testnet",
      includeZeroBalances: false,
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.balances).toBeDefined();
    expect(Array.isArray(parsed.balances)).toBe(true);
    expect(parsed.balances.length).toBeGreaterThan(0);
  });

  it("should include XLM in results", async () => {
    const result = await tool.func({
      accountId: "TEST_SECRET_DO_NOT_USE",
      network: "testnet",
      includeZeroBalances: false,
    });

    const parsed = JSON.parse(result as string);
    const xlm = parsed.balances.find((b: { asset: string }) => b.asset === "XLM");
    expect(xlm).toBeDefined();
    expect(xlm.balance).toBe("100.5000000");
  });

  it("should include USDC trustline", async () => {
    const result = await tool.func({
      accountId: "TEST_SECRET_DO_NOT_USE",
      network: "testnet",
      includeZeroBalances: false,
    });

    const parsed = JSON.parse(result as string);
    const usdc = parsed.balances.find((b: { asset: string }) => b.asset.startsWith("USDC"));
    expect(usdc).toBeDefined();
    expect(usdc.balance).toBe("50.0000000");
  });
});

// PathPaymentStrictSend Tests
describe("createPathPaymentStrictSendTool", () => {
  const tool = createPathPaymentStrictSendTool();

  it("should have the correct name", () => {
    expect(tool.name).toBe("path_payment_strict_send");
  });

  it("should describe slippage protection in description", () => {
    expect(tool.description).toContain("slippage");
  });

  it("should execute a basic XLM → USDC payment", async () => {
    const result = await tool.func({
      sourceSecretKey: "TEST_SECRET_DO_NOT_USE",
      sendAsset: { code: "XLM" },
      sendAmount: "10",
      destAsset: {
        code: "USDC",
        issuer: "TEST_SECRET_DO_NOT_USE",
      },
      minDestAmount: "9",
      destinationAccountId: "TEST_SECRET_DO_NOT_USE",
      network: "testnet",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.transactionHash).toBeDefined();
    expect(parsed.sent).toContain("XLM");
  });

  it("should include explorer URL in result", async () => {
    const result = await tool.func({
      sourceSecretKey: "TEST_SECRET_DO_NOT_USE",
      sendAsset: { code: "XLM" },
      sendAmount: "5",
      destAsset: {
        code: "USDC",
        issuer: "TEST_SECRET_DO_NOT_USE",
      },
      minDestAmount: "4",
      destinationAccountId: "TEST_SECRET_DO_NOT_USE",
      network: "testnet",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.explorerUrl).toContain("stellar.expert");
  });
});

// InvokeContract Tests
describe("createInvokeContractTool", () => {
  const tool = createInvokeContractTool();

  it("should have the correct name", () => {
    expect(tool.name).toBe("invoke_soroban_contract");
  });

  it("should mention Soroban in description", () => {
    expect(tool.description.toLowerCase()).toContain("soroban");
  });

  it("should return simulation result when simulateOnly=true", async () => {
    const result = await tool.func({
      sourceSecretKey: "TEST_SECRET_DO_NOT_USE",
      contractId: "TEST_SECRET_DO_NOT_USE",
      functionName: "get_balance",
      args: [
        {
          type: "address",
          value: "TEST_SECRET_DO_NOT_USE",
        },
      ],
      network: "testnet",
      simulateOnly: true,
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.mode).toBe("simulation_only");
    expect(parsed.estimatedFee).toBeDefined();
  });

  it("should return contractId and functionName in result", async () => {
    const result = await tool.func({
      sourceSecretKey: "TEST_SECRET_DO_NOT_USE",
      contractId: "TEST_SECRET_DO_NOT_USE",
      functionName: "total_supply",
      args: [],
      network: "testnet",
      simulateOnly: true,
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.contractId).toBe("TEST_SECRET_DO_NOT_USE");
    expect(parsed.functionName).toBe("total_supply");
  });
});

// transactionUtils Tests
describe("classifyStellarError", () => {
  it("should classify tx_bad_seq correctly", () => {
    const info = classifyStellarError("tx_bad_seq");
    expect(info.code).toBe("tx_bad_seq");
    expect(info.isFatal).toBe(false);
    expect(info.suggestion).toContain("sequence");
  });

  it("should classify op_no_trust correctly", () => {
    const info = classifyStellarError("op_no_trust");
    expect(info.code).toBe("op_no_trust");
    expect(info.isFatal).toBe(true);
    expect(info.suggestion).toContain("trustline");
  });

  it("should return unknown_error for unrecognized errors", () => {
    const info = classifyStellarError("some_random_error_xyz");
    expect(info.code).toBe("unknown_error");
  });

  it("should classify rate_limit error", () => {
    const info = classifyStellarError("rate limit exceeded");
    expect(info.code).toBe("rate_limited");
    expect(info.isFatal).toBe(false);
  });
});

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on network errors", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { baseDelayMs: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw immediately on non-retryable errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("tx_bad_auth"));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
      "tx_bad_auth"
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should exhaust retries and throw", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("estimateFee", () => {
  it("should return a fee estimate with XLM amount", async () => {
    const estimate = await estimateFee("testnet", 1);
    expect(estimate.totalFeeXLM).toBeDefined();
    expect(estimate.networkCongestionLevel).toMatch(/low|medium|high/);
    expect(estimate.operationCount).toBe(1);
  });

  it("should scale fee by operation count", async () => {
    const single = await estimateFee("testnet", 1);
    const multi = await estimateFee("testnet", 3);
    const singleTotal = parseInt(single.totalFeeStroops);
    const multiTotal = parseInt(multi.totalFeeStroops);
    expect(multiTotal).toBeGreaterThan(singleTotal);
  });
});