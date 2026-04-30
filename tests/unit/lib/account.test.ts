import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  getAccountInfo,
  getBalances,
  getTransactionHistory,
  getOperationHistory,
  fundTestnetAccount,
} from "../../../lib/account";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const testPublicKey = Keypair.random().publicKey();
const issuerKey = Keypair.random().publicKey();

const mockAccountRecord = {
  id: testPublicKey,
  account_id: testPublicKey,
  sequence: "1234567890",
  subentry_count: 3,
  balances: [
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: issuerKey,
      balance: "1500.0000000",
      limit: "922337203685.4775807",
      buying_liabilities: "0.0000000",
      selling_liabilities: "0.0000000",
    },
    {
      asset_type: "native",
      balance: "100.5000000",
      buying_liabilities: "0.0000000",
      selling_liabilities: "0.0000000",
    },
  ],
  signers: [
    { key: testPublicKey, weight: 1, type: "ed25519_public_key" },
  ],
  thresholds: {
    low_threshold: 0,
    med_threshold: 0,
    high_threshold: 0,
  },
  flags: {
    auth_required: false,
    auth_revocable: false,
    auth_immutable: false,
    auth_clawback_enabled: false,
  },
  home_domain: "example.com",
  last_modified_ledger: 12345,
  num_sponsored: 0,
  num_sponsoring: 0,
};

const mockTransactionRecords = [
  {
    id: "tx-1",
    hash: "abc123",
    ledger: 100,
    created_at: "2026-04-30T12:00:00Z",
    source_account: testPublicKey,
    fee_charged: "100",
    operation_count: 1,
    memo_type: "none",
    memo: undefined,
    successful: true,
  },
  {
    id: "tx-2",
    hash: "def456",
    ledger: 101,
    created_at: "2026-04-30T12:05:00Z",
    source_account: testPublicKey,
    fee_charged: "200",
    operation_count: 2,
    memo_type: "text",
    memo: "test",
    successful: true,
  },
];

const mockOperationRecords = [
  {
    _links: {},
    id: "op-1",
    type: "payment",
    type_i: 1,
    created_at: "2026-04-30T12:00:00Z",
    transaction_hash: "abc123",
    source_account: testPublicKey,
    paging_token: "12345",
    transaction_successful: true,
    asset_type: "native",
    amount: "50.0000000",
    from: testPublicKey,
    to: Keypair.random().publicKey(),
  },
];

// ─── Mock Server Factory ────────────────────────────────────────────────────

function makeMockServer(overrides: Partial<Record<string, any>> = {}) {
  return () => ({
    accounts: vi.fn().mockReturnValue({
      accountId: vi.fn().mockReturnValue({
        call: overrides.accountsCall ?? vi.fn(),
      }),
    }),
    transactions: vi.fn().mockReturnValue({
      forAccount: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            call: overrides.transactionsCall ?? vi.fn(),
          }),
        }),
      }),
    }),
    operations: vi.fn().mockReturnValue({
      forAccount: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            call: overrides.operationsCall ?? vi.fn(),
          }),
        }),
      }),
    }),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("lib/account", () => {
  // ── getAccountInfo ──────────────────────────────────────────────────────

  describe("getAccountInfo", () => {
    it("returns well-formed account info for a valid public key", async () => {
      const accountsCall = vi.fn().mockResolvedValue(mockAccountRecord);
      const deps = { createServer: makeMockServer({ accountsCall }) };

      const info = await getAccountInfo(testPublicKey, { network: "testnet" }, deps);

      expect(info.accountId).toBe(testPublicKey);
      expect(info.sequence).toBe("1234567890");
      expect(info.subentryCount).toBe(3);
      expect(info.balances).toHaveLength(2);
      expect(info.signers).toHaveLength(1);
      expect(info.homeDomain).toBe("example.com");
    });

    it("correctly maps native and issued balances", async () => {
      const accountsCall = vi.fn().mockResolvedValue(mockAccountRecord);
      const deps = { createServer: makeMockServer({ accountsCall }) };

      const info = await getAccountInfo(testPublicKey, { network: "testnet" }, deps);

      const usdcBalance = info.balances.find(b => b.assetCode === "USDC");
      expect(usdcBalance).toBeDefined();
      expect(usdcBalance!.balance).toBe("1500.0000000");
      expect(usdcBalance!.limit).toBeDefined();

      const xlmBalance = info.balances.find(b => b.assetType === "native");
      expect(xlmBalance).toBeDefined();
      expect(xlmBalance!.balance).toBe("100.5000000");
      expect(xlmBalance!.assetCode).toBeUndefined();
    });

    it("maps thresholds and flags correctly", async () => {
      const accountsCall = vi.fn().mockResolvedValue(mockAccountRecord);
      const deps = { createServer: makeMockServer({ accountsCall }) };

      const info = await getAccountInfo(testPublicKey, { network: "testnet" }, deps);

      expect(info.thresholds.lowThreshold).toBe(0);
      expect(info.flags.authRequired).toBe(false);
      expect(info.flags.authImmutable).toBe(false);
    });

    it("throws on invalid public key", async () => {
      await expect(
        getAccountInfo("invalid-key", { network: "testnet" })
      ).rejects.toThrow("Invalid Stellar public key");
    });

    it("throws on empty public key", async () => {
      await expect(
        getAccountInfo("", { network: "testnet" })
      ).rejects.toThrow("Invalid Stellar public key");
    });

    it("throws with helpful message when account is not found (404)", async () => {
      const accountsCall = vi.fn().mockRejectedValue({ response: { status: 404 } });
      const deps = { createServer: makeMockServer({ accountsCall }) };

      await expect(
        getAccountInfo(testPublicKey, { network: "testnet" }, deps)
      ).rejects.toThrow("not found on testnet");
    });
  });

  // ── getBalances ─────────────────────────────────────────────────────────

  describe("getBalances", () => {
    it("returns only balances from account info", async () => {
      const accountsCall = vi.fn().mockResolvedValue(mockAccountRecord);
      const deps = { createServer: makeMockServer({ accountsCall }) };

      const balances = await getBalances(testPublicKey, { network: "testnet" }, deps);

      expect(balances).toHaveLength(2);
      expect(balances[0].balance).toBe("1500.0000000");
      expect(balances[1].balance).toBe("100.5000000");
    });
  });

  // ── getTransactionHistory ───────────────────────────────────────────────

  describe("getTransactionHistory", () => {
    it("returns recent transactions", async () => {
      const transactionsCall = vi.fn().mockResolvedValue({ records: mockTransactionRecords });
      const deps = { createServer: makeMockServer({ transactionsCall }) };

      const txs = await getTransactionHistory(
        testPublicKey, { network: "testnet" }, 10, "desc", deps
      );

      expect(txs).toHaveLength(2);
      expect(txs[0].hash).toBe("abc123");
      expect(txs[0].successful).toBe(true);
      expect(txs[1].memo).toBe("test");
    });

    it("validates limit boundaries", async () => {
      await expect(
        getTransactionHistory(testPublicKey, { network: "testnet" }, 0)
      ).rejects.toThrow("limit must be between 1 and 50");

      await expect(
        getTransactionHistory(testPublicKey, { network: "testnet" }, 100)
      ).rejects.toThrow("limit must be between 1 and 50");
    });

    it("throws on invalid public key", async () => {
      await expect(
        getTransactionHistory("bad", { network: "testnet" })
      ).rejects.toThrow("Invalid Stellar public key");
    });
  });

  // ── getOperationHistory ─────────────────────────────────────────────────

  describe("getOperationHistory", () => {
    it("returns recent operations with extracted details", async () => {
      const operationsCall = vi.fn().mockResolvedValue({ records: mockOperationRecords });
      const deps = { createServer: makeMockServer({ operationsCall }) };

      const ops = await getOperationHistory(
        testPublicKey, { network: "testnet" }, 10, "desc", deps
      );

      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe("payment");
      expect(ops[0].transactionHash).toBe("abc123");
      expect(ops[0].details).toHaveProperty("amount");
      expect(ops[0].details).not.toHaveProperty("_links");
      expect(ops[0].details).not.toHaveProperty("paging_token");
    });

    it("validates limit boundaries", async () => {
      await expect(
        getOperationHistory(testPublicKey, { network: "testnet" }, 0)
      ).rejects.toThrow("limit must be between 1 and 50");

      await expect(
        getOperationHistory(testPublicKey, { network: "testnet" }, 100)
      ).rejects.toThrow("limit must be between 1 and 50");
    });
  });

  // ── fundTestnetAccount ──────────────────────────────────────────────────

  describe("fundTestnetAccount", () => {
    it("returns success when friendbot funds the account", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("{}"),
      });

      const result = await fundTestnetAccount(testPublicKey, mockFetch as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain("funded with 10,000 test XLM");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("friendbot.stellar.org")
      );
    });

    it("handles already-funded accounts gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue('{"detail":"createAccountAlreadyExist"}'),
      });

      const result = await fundTestnetAccount(testPublicKey, mockFetch as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already been funded");
    });

    it("throws on invalid public key", async () => {
      await expect(
        fundTestnetAccount("invalid", vi.fn() as any)
      ).rejects.toThrow("Invalid Stellar public key");
    });
  });
});
