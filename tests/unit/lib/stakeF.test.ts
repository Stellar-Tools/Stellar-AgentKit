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
const CONTRACT_ADDRESS = Keypair.random().publicKey();

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
  // Must return a Promise so .catch() works in stakeF.ts line 56
  mockServer.prepareTransaction.mockResolvedValue({
    toXDR: () => "mock-xdr-string",
  });
  mockServer.sendTransaction.mockResolvedValue({ hash: "mock-tx-hash-abc123" });
  mockServer.getTransaction.mockResolvedValue({ status: "SUCCESS" });
});

// ── Helpers ────────────────────────────────────────────────────────────────
const testnetConfig = {
  network: "testnet" as const,
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractAddress: CONTRACT_ADDRESS,
};

const mainnetConfig = {
  network: "mainnet" as const,
  rpcUrl: "https://soroban-mainnet.stellar.org",
  contractAddress: CONTRACT_ADDRESS,
};

// ── Tests ──────────────────────────────────────────────────────────────────
describe("stakeF — addressToScVal validation", () => {
  it("rejects addresses that are not valid Stellar public keys", async () => {
    const result = await stake("INVALID_ADDRESS", 100, testnetConfig);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });

  it("rejects token addresses with wrong format in initialize", async () => {
    const result = await initialize(CALLER, "bad-token-address", 10, testnetConfig);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });
});

describe("stakeF — initialize", () => {
  it("returns a success message on valid testnet initialization", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 100, testnetConfig);
    expect(result).toBe("Contract initialized successfully");
  });

  it("returns a success message on valid mainnet initialization with explicit contract", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 50, mainnetConfig);
    expect(result).toBe("Contract initialized successfully");
  });

  it("accepts zero as a reward rate (edge case)", async () => {
    const result = await initialize(CALLER, TOKEN_ADDRESS, 0, testnetConfig);
    expect(result).toBe("Contract initialized successfully");
  });
});

describe("stakeF — stake", () => {
  it("returns a confirmation message with the staked amount", async () => {
    const result = await stake(CALLER, 1000, testnetConfig);
    expect(result).toBe("Staked 1000 successfully");
  });

  it("handles large stake amounts correctly", async () => {
    const result = await stake(CALLER, 999_999_999, testnetConfig);
    expect(result).toBe("Staked 999999999 successfully");
  });

  it("propagates mainnet config without falling back to testnet contract", async () => {
    const result = await stake(CALLER, 500, mainnetConfig);
    expect(result).toBe("Staked 500 successfully");
  });
});

describe("stakeF — unstake", () => {
  it("returns a confirmation message with the unstaked amount", async () => {
    const result = await unstake(CALLER, 200, testnetConfig);
    expect(result).toBe("Unstaked 200 successfully");
  });

  it("handles partial unstake (amount less than full stake)", async () => {
    const result = await unstake(CALLER, 1, testnetConfig);
    expect(result).toBe("Unstaked 1 successfully");
  });
});

describe("stakeF — claimRewards", () => {
  it("returns success message on successful claim", async () => {
    const result = await claimRewards(CALLER, testnetConfig);
    expect(result).toBe("Rewards claimed successfully");
  });

  it("works on mainnet config without error", async () => {
    const result = await claimRewards(CALLER, mainnetConfig);
    expect(result).toBe("Rewards claimed successfully");
  });
});

describe("stakeF — getStake", () => {
  it("returns a stake info string for the queried user", async () => {
    const result = await getStake(CALLER, USER_ADDRESS, testnetConfig);
    expect(typeof result).toBe("string");
    expect(result).toContain(USER_ADDRESS);
  });

  it("rejects invalid user addresses early", async () => {
    const result = await getStake(CALLER, "0xBADADDRESS", testnetConfig);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/Invalid address format/i);
  });
});

describe("stakeF — mainnet safeguard", () => {
  it("succeeds when mainnet config includes a valid contractAddress", async () => {
    const result = await stake(CALLER, 100, mainnetConfig);
    expect(result).toBe("Staked 100 successfully");
  });
});

describe("stakeF — network switching (RPC URL propagation)", () => {
  it("uses testnet RPC URL config for testnet operations", async () => {
    // Verify testnet config succeeds end-to-end (no throws)
    const result = await stake(CALLER, 10, testnetConfig);
    expect(result).toBe("Staked 10 successfully");
  });

  it("uses mainnet RPC URL config for mainnet operations", async () => {
    // Verify mainnet config with a contract address succeeds end-to-end
    const result = await stake(CALLER, 10, mainnetConfig);
    expect(result).toBe("Staked 10 successfully");
  });
});
