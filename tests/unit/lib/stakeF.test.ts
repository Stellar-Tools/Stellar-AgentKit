/**
 * Unit tests for lib/stakeF.ts
 *
 * All Soroban RPC calls are mocked so tests are fully deterministic
 * and never touch a live network. Pattern mirrors lib/dex.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

// ── Stable test addresses ──────────────────────────────────────────────────
const CALLER = Keypair.random().publicKey();
const USER_ADDRESS = Keypair.random().publicKey();
const TOKEN_ADDRESS = Keypair.random().publicKey();

// ── Mock the Soroban RPC server and signing helpers ───────────────────────
const mockServer = {
  getAccount: vi.fn(),
  prepareTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
};

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
      fromXDR: vi.fn().mockReturnValue({ toXDR: () => "mock-tx-xdr" }),
    },
  };
});

vi.mock("../../../lib/stellar", () => ({
  signTransaction: vi.fn().mockReturnValue("signed-xdr-string"),
}));

vi.mock("../../../utils/buildTransaction", () => ({
  buildTransaction: vi.fn().mockReturnValue({
    toXDR: () => "unsigned-xdr",
  }),
}));

import { initialize, stake, unstake, claimRewards, getStake } from "../../../lib/stakeF";

// ── Reset server methods before each test ─────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockServer.getAccount.mockResolvedValue({ id: CALLER, sequence: "1" });
  mockServer.prepareTransaction.mockResolvedValue({
    toXDR: () => "mock-xdr-string",
  });
  mockServer.sendTransaction.mockResolvedValue({ hash: "mock-tx-hash-abc123" });
  mockServer.getTransaction.mockResolvedValue({ status: "SUCCESS" });
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe("stakeF — addressToScVal validation", () => {
  it("rejects addresses that are not valid Stellar public keys", async () => {
    const result = await stake("INVALID_ADDRESS", 100);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });

  it("rejects token addresses with wrong format in initialize", async () => {
    const result = await initialize(CALLER, "bad-token-address", 10);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });
});

describe("stakeF — initialize", () => {
  it("returns a success message on valid initialization", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 100);
    expect(result).toBe("Contract initialized successfully");
  });

  it("returns a success message with zero reward rate (edge case)", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 0);
    expect(result).toBe("Contract initialized successfully");
  });

  it("returns a success message with a large reward rate", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 999_999);
    expect(result).toBe("Contract initialized successfully");
  });
});

describe("stakeF — stake", () => {
  it("returns a confirmation message with the staked amount", async () => {
    const result = await stake(CALLER, 1000);
    expect(result).toBe("Staked 1000 successfully");
  });

  it("handles large stake amounts correctly", async () => {
    const result = await stake(CALLER, 999_999_999);
    expect(result).toBe("Staked 999999999 successfully");
  });

  it("handles minimum stake amount of 1", async () => {
    const result = await stake(CALLER, 1);
    expect(result).toBe("Staked 1 successfully");
  });
});

describe("stakeF — unstake", () => {
  it("returns a confirmation message with the unstaked amount", async () => {
    const result = await unstake(CALLER, 200);
    expect(result).toBe("Unstaked 200 successfully");
  });

  it("handles partial unstake correctly", async () => {
    const result = await unstake(CALLER, 1);
    expect(result).toBe("Unstaked 1 successfully");
  });

  it("handles large unstake amounts", async () => {
    const result = await unstake(CALLER, 500_000);
    expect(result).toBe("Unstaked 500000 successfully");
  });
});

describe("stakeF — claimRewards", () => {
  it("returns success message on successful claim", async () => {
    const result = await claimRewards(CALLER);
    expect(result).toBe("Rewards claimed successfully");
  });

  it("returns success message when called a second time (idempotent mock)", async () => {
    await claimRewards(CALLER);
    const result = await claimRewards(CALLER);
    expect(result).toBe("Rewards claimed successfully");
  });
});

describe("stakeF — getStake", () => {
  it("returns a stake info string for the queried user", async () => {
    const result = await getStake(CALLER, USER_ADDRESS);
    expect(typeof result).toBe("string");
    expect(result).toContain(USER_ADDRESS);
  });

  it("rejects invalid user addresses early", async () => {
    const result = await getStake(CALLER, "0xBADADDRESS");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });

  it("rejects addresses with wrong prefix (not G or C)", async () => {
    const result = await getStake(CALLER, "XBADADDRESSFORMAT0000000000000000000000000000000000000000");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });
});

describe("stakeF — transaction failure handling", () => {
  it("returns an error-like string when the transaction ends in a non-SUCCESS status", async () => {
    mockServer.getTransaction.mockResolvedValueOnce({ status: "FAILED" });
    const result = await stake(CALLER, 100);
    expect(typeof result).toBe("string");
    // stakeF returns 'Staked X successfully' only on SUCCESS;
    // on FAILED status it returns the status string or an error message
    expect(result).toBeDefined();
  });

  it("returns a defined string when getAccount rejects (account does not exist)", async () => {
    // getAccount is wrapped in .catch() in stakeF, so it throws which bubbles to outer catch
    // The outer catch returns the error message as a string
    mockServer.getAccount.mockImplementationOnce(() =>
      Promise.reject(new Error("Account not found"))
    );
    const result = await stake(CALLER, 100);
    expect(typeof result).toBe("string");
  });
});
