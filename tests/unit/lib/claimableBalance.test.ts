import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Account, Keypair } from "@stellar/stellar-sdk";

import {
  buildPredicate,
  createClaimableBalance,
  claimClaimableBalance,
  listClaimableBalances,
  extractBalanceIdsFromTransactionResult,
  MAX_CLAIMANTS_PER_BALANCE,
  MAX_OPERATIONS_PER_TRANSACTION,
  MAX_PREDICATE_DEPTH,
  DEFAULT_TRANSACTION_TIMEOUT_SECONDS,
  type ClaimPredicate,
} from "../../../lib/claimableBalance";

const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

describe("claimableBalance.constants", () => {
  it("exports protocol constants for downstream consumers", () => {
    expect(MAX_CLAIMANTS_PER_BALANCE).toBe(10);
    expect(MAX_OPERATIONS_PER_TRANSACTION).toBe(100);
    expect(MAX_PREDICATE_DEPTH).toBeGreaterThan(0);
    expect(DEFAULT_TRANSACTION_TIMEOUT_SECONDS).toBeGreaterThan(0);
  });
});

describe("claimableBalance.buildPredicate", () => {
  it("builds an unconditional predicate by default", () => {
    expect(() => buildPredicate(undefined)).not.toThrow();
    expect(() => buildPredicate({ type: "unconditional" })).not.toThrow();
  });

  it("validates relative-time predicates", () => {
    expect(() =>
      buildPredicate({ type: "beforeRelativeTime", seconds: 60 })
    ).not.toThrow();
    expect(() =>
      buildPredicate({ type: "beforeRelativeTime", seconds: 0 })
    ).toThrow(/positive integer/);
    expect(() =>
      buildPredicate({ type: "beforeRelativeTime", seconds: -1 as any })
    ).toThrow(/positive integer/);
  });

  it("validates absolute-time predicates", () => {
    expect(() =>
      buildPredicate({ type: "beforeAbsoluteTime", epochSeconds: "1735689600" })
    ).not.toThrow();
    expect(() =>
      buildPredicate({ type: "beforeAbsoluteTime", epochSeconds: "abc" as any })
    ).toThrow(/positive integer/);
  });

  it("supports nested compound predicates", () => {
    const predicate: ClaimPredicate = {
      type: "and",
      predicates: [
        { type: "beforeRelativeTime", seconds: 100 },
        { type: "not", predicate: { type: "unconditional" } },
      ],
    };
    expect(() => buildPredicate(predicate)).not.toThrow();
  });

  it("rejects malformed compound predicates", () => {
    expect(() =>
      buildPredicate({ type: "and", predicates: [] as any })
    ).toThrow(/exactly 2/);
    expect(() => buildPredicate({ type: "not" } as any)).toThrow(/inner/);
  });

  it("guards against excessive nesting using the default cap", () => {
    let p: ClaimPredicate = { type: "unconditional" };
    for (let i = 0; i < MAX_PREDICATE_DEPTH + 3; i++) {
      p = { type: "not", predicate: p };
    }
    expect(() => buildPredicate(p)).toThrow(/too deep/);
  });

  it("honours a custom max-depth override", () => {
    const p: ClaimPredicate = {
      type: "not",
      predicate: { type: "not", predicate: { type: "unconditional" } },
    };
    expect(() => buildPredicate(p, 0, 1)).toThrow(/too deep/);
    expect(() => buildPredicate(p, 0, 5)).not.toThrow();
  });
});

describe("claimableBalance.extractBalanceIdsFromTransactionResult", () => {
  it("returns empty array on malformed XDR", () => {
    expect(extractBalanceIdsFromTransactionResult("not-xdr")).toEqual([]);
  });

  it("returns empty array when result_xdr is missing", () => {
    expect(extractBalanceIdsFromTransactionResult("")).toEqual([]);
  });
});

describe("claimableBalance.createClaimableBalance", () => {
  const sourceKp = Keypair.random();
  const destKp = Keypair.random();
  let loadAccountSpy: any;
  let submitSpy: any;

  beforeEach(() => {
    const account = new Account(sourceKp.publicKey(), "1");
    const sdk = require("@stellar/stellar-sdk");
    loadAccountSpy = vi
      .spyOn(sdk.Horizon.Server.prototype as any, "loadAccount")
      .mockResolvedValue(account);
    submitSpy = vi
      .spyOn(sdk.Horizon.Server.prototype as any, "submitTransaction")
      .mockResolvedValue({
        hash: "abc123",
        // Empty result_xdr → balanceIds will be []. Real Horizon returns
        // a populated XDR; integration tests cover end-to-end parsing.
        result_xdr: "",
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects bad amount", async () => {
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "XLM" },
          amount: "0",
          claimants: [{ destination: destKp.publicKey() }],
        }
      )
    ).rejects.toThrow(/greater than zero/);
  });

  it("rejects empty claimants list", async () => {
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "XLM" },
          amount: "10",
          claimants: [],
        }
      )
    ).rejects.toThrow(/At least one claimant/);
  });

  it("accepts more than 10 claimants — each becomes its own 1-claimant balance", async () => {
    const claimants = Array.from({ length: 25 }, () => ({
      destination: Keypair.random().publicKey(),
    }));
    const result = await createClaimableBalance(
      { network: "testnet", horizonUrl: TESTNET_HORIZON },
      {
        sourceSecret: sourceKp.secret(),
        asset: { code: "XLM" },
        amount: "10",
        claimants,
      }
    );
    expect(result.transactionHash).toBe("abc123");
    const submittedTx = submitSpy.mock.calls[0][0];
    expect(submittedTx.operations).toHaveLength(25);
  });

  it("rejects more than the per-tx ops cap (default = MAX_OPERATIONS_PER_TRANSACTION)", async () => {
    const claimants = Array.from(
      { length: MAX_OPERATIONS_PER_TRANSACTION + 1 },
      () => ({ destination: Keypair.random().publicKey() })
    );
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "XLM" },
          amount: "10",
          claimants,
        }
      )
    ).rejects.toThrow(new RegExp(`at most ${MAX_OPERATIONS_PER_TRANSACTION}`));
  });

  it("honours a custom maxOperationsPerTransaction override", async () => {
    const claimants = Array.from({ length: 6 }, () => ({
      destination: Keypair.random().publicKey(),
    }));
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "XLM" },
          amount: "10",
          claimants,
          options: { maxOperationsPerTransaction: 5 },
        }
      )
    ).rejects.toThrow(/at most 5/);
  });

  it("requires issuer for non-native asset", async () => {
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "USDC" },
          amount: "10",
          claimants: [{ destination: destKp.publicKey() }],
        }
      )
    ).rejects.toThrow(/issuer/);
  });

  it("submits a signed tx with one CreateClaimableBalance op per claimant", async () => {
    const result = await createClaimableBalance(
      { network: "testnet", horizonUrl: TESTNET_HORIZON },
      {
        sourceSecret: sourceKp.secret(),
        asset: { code: "XLM" },
        amount: "5",
        claimants: [
          {
            destination: destKp.publicKey(),
            predicate: { type: "beforeRelativeTime", seconds: 3600 },
          },
        ],
      }
    );

    expect(result.transactionHash).toBe("abc123");
    expect(Array.isArray(result.balanceIds)).toBe(true);
    expect(loadAccountSpy).toHaveBeenCalledWith(sourceKp.publicKey());
    expect(submitSpy).toHaveBeenCalledTimes(1);

    const submittedTx = submitSpy.mock.calls[0][0];
    expect(submittedTx.signatures.length).toBeGreaterThan(0);
    expect(submittedTx.operations).toHaveLength(1);
    expect(submittedTx.operations[0].type).toBe("createClaimableBalance");
  });

  it("propagates Horizon submission failures", async () => {
    submitSpy.mockRejectedValueOnce(new Error("tx_failed: op_underfunded"));
    await expect(
      createClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        {
          sourceSecret: sourceKp.secret(),
          asset: { code: "XLM" },
          amount: "5",
          claimants: [{ destination: destKp.publicKey() }],
        }
      )
    ).rejects.toThrow(/op_underfunded/);
  });
});

describe("claimableBalance.claimClaimableBalance", () => {
  const claimerKp = Keypair.random();
  let submitSpy: any;

  beforeEach(() => {
    const sdk = require("@stellar/stellar-sdk");
    vi.spyOn(sdk.Horizon.Server.prototype as any, "loadAccount").mockResolvedValue(
      new Account(claimerKp.publicKey(), "1")
    );
    submitSpy = vi
      .spyOn(sdk.Horizon.Server.prototype as any, "submitTransaction")
      .mockResolvedValue({ hash: "claim-hash", result_xdr: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-hex balance ids", async () => {
    await expect(
      claimClaimableBalance(
        { network: "testnet", horizonUrl: TESTNET_HORIZON },
        { claimerSecret: claimerKp.secret(), balanceId: "not-hex!" }
      )
    ).rejects.toThrow(/hex/);
  });

  it("submits a signed claim transaction", async () => {
    const balanceId = "00000000" + "ab".repeat(32);
    const result = await claimClaimableBalance(
      { network: "testnet", horizonUrl: TESTNET_HORIZON },
      { claimerSecret: claimerKp.secret(), balanceId }
    );

    expect(result.transactionHash).toBe("claim-hash");
    expect(result.balanceId).toBe(balanceId);
    const submittedTx = submitSpy.mock.calls[0][0];
    expect(submittedTx.operations[0].type).toBe("claimClaimableBalance");
  });
});

describe("claimableBalance.listClaimableBalances", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries Horizon with provided filters and maps records", async () => {
    const sdk = require("@stellar/stellar-sdk");

    const callBuilder: any = {
      claimant: vi.fn().mockReturnThis(),
      sponsor: vi.fn().mockReturnThis(),
      asset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnThis(),
      call: vi.fn().mockResolvedValue({
        records: [
          {
            id: "00000000abc",
            asset: "native",
            amount: "10.0000000",
            sponsor: "GSPONSOR",
            last_modified_ledger: 42,
            claimants: [
              {
                destination: "GDEST",
                predicate: { unconditional: true },
              },
            ],
          },
        ],
      }),
    };

    vi.spyOn(sdk.Horizon.Server.prototype as any, "claimableBalances").mockReturnValue(
      callBuilder
    );

    const records = await listClaimableBalances(
      { network: "testnet", horizonUrl: TESTNET_HORIZON },
      { claimant: "GDEST", limit: 5 }
    );

    expect(callBuilder.claimant).toHaveBeenCalledWith("GDEST");
    expect(callBuilder.limit).toHaveBeenCalledWith(5);
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("00000000abc");
    expect(records[0].claimants[0].destination).toBe("GDEST");
  });
});
