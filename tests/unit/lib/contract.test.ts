/**
 * Unit tests for lib/contract.ts (Soroban Liquidity Pool interactions)
 *
 * All Soroban RPC calls are mocked via vi.mock so tests are fully deterministic
 * and never touch a live network. Pattern mirrors lib/dex.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

// ── Stable test addresses ──────────────────────────────────────────────────
const CALLER = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();

// ── The shared mock server object — methods are set in beforeEach ──────────
const mockServer = {
  getAccount: vi.fn(),
  simulateTransaction: vi.fn(),
  prepareTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
};

// vi.mock is hoisted before imports, so we declare the mock before importing the module.
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  class MockServer {
    constructor() {
      return mockServer;
    }
  }
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: MockServer,
    },
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      // Prevent real XDR parsing of our mock string
      fromXDR: vi.fn().mockReturnValue({ toXDR: () => "mock-tx-xdr" }),
    },
  };
});

vi.mock("../../../lib/stellar", () => ({
  signTransaction: vi.fn().mockReturnValue("mock-signed-xdr"),
}));

vi.mock("../../../utils/buildTransaction", () => ({
  buildTransaction: vi.fn().mockReturnValue({
    toXDR: () => "unsigned-mock-xdr",
  }),
}));

import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../../../lib/contract";

// ── Reset methods to safe defaults before each test ────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockServer.getAccount.mockResolvedValue({ id: CALLER, sequence: "1" });
  mockServer.simulateTransaction.mockResolvedValue({
    minResourceFee: "100",
    transactionData: {},
  });
  // prepareTransaction must return a Promise so .catch() works in lib/contract.ts
  mockServer.prepareTransaction.mockResolvedValue({
    toXDR: () => "mock-prepared-xdr",
  });
  mockServer.sendTransaction.mockResolvedValue({ hash: "mock-tx-hash-abc" });
  mockServer.getTransaction.mockResolvedValue({ status: "SUCCESS" });
});

// ── Address validation ─────────────────────────────────────────────────────
describe("contract — address validation", () => {
  it("throws for an invalid deposit recipient address", async () => {
    await expect(
      deposit(CALLER, "0xNOT_STELLAR", "1000", "900", "500", "400")
    ).rejects.toThrow("Invalid address format");
  });

  it("throws for an invalid swap recipient address", async () => {
    await expect(
      swap(CALLER, "bad-address", true, "100", "110")
    ).rejects.toThrow("Invalid address format");
  });

  it("throws for an invalid withdraw recipient address", async () => {
    await expect(
      withdraw(CALLER, "ZZZZ", "200", "100", "100")
    ).rejects.toThrow("Invalid address format");
  });
});

// ── getShareId ─────────────────────────────────────────────────────────────
describe("contract — getShareId", () => {
  it("returns the share ID string from a read-only simulation result", async () => {
    const { nativeToScVal } = await import("@stellar/stellar-sdk");
    const fakeShareId = "CSHARE00PLACEHOLDER000000000000000000000000000000000000000";
    const encoded = nativeToScVal(fakeShareId, { type: "string" }).toXDR("base64");

    mockServer.simulateTransaction.mockResolvedValue({
      results: [{ xdr: encoded }],
    });

    const result = await getShareId(CALLER);
    expect(result).toBe(fakeShareId);
  });

  it("throws when simulation returns an error field", async () => {
    mockServer.simulateTransaction.mockResolvedValue({
      error: "Contract not found",
    });
    await expect(getShareId(CALLER)).rejects.toThrow("Simulation failed");
  });

  it("throws when simulation results have no xdr field", async () => {
    mockServer.simulateTransaction.mockResolvedValue({
      results: [{}],
    });
    await expect(getShareId(CALLER)).rejects.toThrow(
      "No return value in simulation results"
    );
  });
});

// ── getReserves ────────────────────────────────────────────────────────────
describe("contract — getReserves", () => {
  it("returns null on SUCCESS when no returnValue is provided", async () => {
    mockServer.getTransaction.mockResolvedValue({ status: "SUCCESS" });
    const result = await getReserves(CALLER);
    expect(result).toBeNull();
  });
});

// ── deposit ────────────────────────────────────────────────────────────────
describe("contract — deposit", () => {
  it("completes without error for valid inputs", async () => {
    await expect(
      deposit(CALLER, RECIPIENT, "1000", "900", "500", "450")
    ).resolves.not.toThrow();
  });

  it("throws when the transaction submission fails", async () => {
    mockServer.sendTransaction.mockRejectedValue(new Error("Insufficient balance"));
    await expect(
      deposit(CALLER, RECIPIENT, "1000", "900", "500", "450")
    ).rejects.toThrow();
  });

  it("throws when getAccount fails (account does not exist)", async () => {
    mockServer.getAccount.mockRejectedValue(new Error("Account not found"));
    await expect(
      deposit(CALLER, RECIPIENT, "1000", "900", "500", "450")
    ).rejects.toThrow("Failed to fetch account");
  });
});

// ── swap ──────────────────────────────────────────────────────────────────
describe("contract — swap", () => {
  it("completes without error for a buyA=true swap", async () => {
    await expect(
      swap(CALLER, RECIPIENT, true, "100", "110")
    ).resolves.not.toThrow();
  });

  it("completes without error for a buyA=false swap", async () => {
    await expect(
      swap(CALLER, RECIPIENT, false, "200", "220")
    ).resolves.not.toThrow();
  });

  it("throws when simulation explicitly returns an error", async () => {
    mockServer.simulateTransaction.mockResolvedValue({
      error: "Slippage exceeded",
    });
    await expect(
      swap(CALLER, RECIPIENT, true, "100", "110")
    ).rejects.toThrow("Simulation failed: Slippage exceeded");
  });
});

// ── withdraw ──────────────────────────────────────────────────────────────
describe("contract — withdraw", () => {
  it("completes without error for valid inputs", async () => {
    await expect(
      withdraw(CALLER, RECIPIENT, "200", "90", "90")
    ).resolves.not.toThrow();
  });

  it("throws when the transaction status is FAILED", async () => {
    mockServer.getTransaction.mockResolvedValue({ status: "FAILED" });
    await expect(
      withdraw(CALLER, RECIPIENT, "200", "90", "90")
    ).rejects.toThrow("Transaction failed with status");
  });
});
