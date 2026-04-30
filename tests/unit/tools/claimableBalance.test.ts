import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Account, Keypair } from "@stellar/stellar-sdk";

import { StellarClaimableBalanceTool } from "../../../tools/claimableBalance";

const sourceKp = Keypair.random();
const claimerKp = Keypair.random();
const recipient = Keypair.random().publicKey();

describe("StellarClaimableBalanceTool", () => {
  const previousPriv = process.env.STELLAR_PRIVATE_KEY;
  const previousClaimer = process.env.STELLAR_CLAIMER_PRIVATE_KEY;

  beforeEach(() => {
    process.env.STELLAR_PRIVATE_KEY = sourceKp.secret();
    process.env.STELLAR_CLAIMER_PRIVATE_KEY = claimerKp.secret();

    const sdk = require("@stellar/stellar-sdk");
    vi.spyOn(sdk.Horizon.Server.prototype as any, "loadAccount").mockResolvedValue(
      new Account(sourceKp.publicKey(), "1")
    );
    vi.spyOn(sdk.Horizon.Server.prototype as any, "submitTransaction").mockResolvedValue({
      hash: "tool-tx",
      result_xdr: "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousPriv === undefined) delete process.env.STELLAR_PRIVATE_KEY;
    else process.env.STELLAR_PRIVATE_KEY = previousPriv;
    if (previousClaimer === undefined) delete process.env.STELLAR_CLAIMER_PRIVATE_KEY;
    else process.env.STELLAR_CLAIMER_PRIVATE_KEY = previousClaimer;
  });

  it("exposes a stable LangChain DynamicStructuredTool surface", () => {
    expect(StellarClaimableBalanceTool.name).toBe("stellar_claimable_balance");
    expect(typeof StellarClaimableBalanceTool.description).toBe("string");
    expect(StellarClaimableBalanceTool.description.length).toBeGreaterThan(0);
    expect(typeof StellarClaimableBalanceTool.func).toBe("function");
  });

  it("returns ok=false when create is missing required fields", async () => {
    const out = await StellarClaimableBalanceTool.func({
      action: "create",
    } as any);
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/asset.*amount.*claimants/i);
  });

  it("create: routes through createClaimableBalance and returns the tx hash", async () => {
    const out = await StellarClaimableBalanceTool.func({
      action: "create",
      asset: { code: "XLM" },
      amount: "10",
      claimants: [
        {
          destination: recipient,
          predicate: { type: "beforeRelativeTime", seconds: 3600 },
        },
      ],
    });
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(parsed.transactionHash).toBe("tool-tx");
    expect(Array.isArray(parsed.balanceIds)).toBe(true);
  });

  it("claim: rejects without balanceId", async () => {
    const out = await StellarClaimableBalanceTool.func({ action: "claim" } as any);
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/balanceId/);
  });

  it("claim: routes through claimClaimableBalance and returns tx hash", async () => {
    const balanceId = "00000000" + "ab".repeat(32);
    const out = await StellarClaimableBalanceTool.func({
      action: "claim",
      balanceId,
    });
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(parsed.transactionHash).toBe("tool-tx");
  });

  it("list: returns records via Horizon claimableBalances builder", async () => {
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
            id: "abc",
            asset: "native",
            amount: "1.0000000",
            last_modified_ledger: 1,
            claimants: [],
          },
        ],
      }),
    };
    vi.spyOn(sdk.Horizon.Server.prototype as any, "claimableBalances").mockReturnValue(
      callBuilder
    );

    const out = await StellarClaimableBalanceTool.func({
      action: "list",
      filter: { claimant: recipient, limit: 5 },
    });
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].id).toBe("abc");
    expect(callBuilder.claimant).toHaveBeenCalledWith(recipient);
  });

  it("create: returns ok=false when STELLAR_PRIVATE_KEY is missing", async () => {
    delete process.env.STELLAR_PRIVATE_KEY;
    const out = await StellarClaimableBalanceTool.func({
      action: "create",
      asset: { code: "XLM" },
      amount: "10",
      claimants: [{ destination: recipient }],
    });
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/STELLAR_PRIVATE_KEY/);
  });
});
