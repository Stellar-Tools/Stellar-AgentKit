import { Account, Keypair } from "@stellar/stellar-sdk";
import {
  estimateSwapFee,
  estimateDepositFee,
  estimateWithdrawalFee,
  calculateOperationCost,
} from "../fees/estimation";
import { validateSlippage, calculatePriceImpact } from "../slippage/protection";
import { TTLCache, SorobanCaches, PriceCalculator, sorobanCaches } from "../optimization";
import { BatchTransactionBuilder } from "../operations/batch";

afterAll(() => {
  sorobanCaches.stopAutoCleanup();
});

describe("Integration: Fee + Safety + Optimization", () => {
  it("estimates swap fee with consistent fee units", () => {
    const estimate = estimateSwapFee("1000");

    expect(typeof estimate.baseFee).toBe("string");
    expect(typeof estimate.networkFee).toBe("string");
    expect(estimate.totalFee).toBe(estimate.networkFee);
  });

  it("estimates LP deposit and withdrawal fees as network costs", () => {
    const deposit = estimateDepositFee("100", "200");
    const withdrawal = estimateWithdrawalFee("300");

    expect(deposit.simulationFee).toBe("0");
    expect(withdrawal.simulationFee).toBe("0");
    expect(Number(deposit.totalFee)).toBeGreaterThan(Number(withdrawal.totalFee));
  });

  it("handles operation cost slippage safely when input is zero", () => {
    const cost = calculateOperationCost("0", "0", estimateSwapFee("1"));
    expect(cost.slippagePercent).toBe("0.00");
  });

  it("validates slippage and returns warning near configured limit", () => {
    const result = validateSlippage("100", "99", "91", 10);

    expect(result.valid).toBe(true);
    expect(typeof result.warning).toBe("string");
  });

  it("computes price impact with deterministic output", () => {
    const impact = calculatePriceImpact({
      reserveIn: "10000",
      reserveOut: "10000",
      amountIn: "100",
    });

    expect(impact.priceImpact).toBeGreaterThan(0);
    expect(["low", "medium", "high", "extreme"]).toContain(impact.riskLevel);
  });
});

describe("Integration: Optimization Primitives", () => {
  it("expires cached values by TTL", async () => {
    const cache = new TTLCache<string, string>(5);
    cache.set("k", "v");

    expect(cache.get("k")).toBe("v");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cache.get("k")).toBeUndefined();
  });

  it("supports cleanup timer teardown", () => {
    const caches = new SorobanCaches();
    caches.poolResources.set("pool", [1n, 2n]);

    expect(caches.getStats().total).toBe(1);

    caches.stopAutoCleanup();
    caches.clearAll();

    expect(caches.getStats().total).toBe(0);
  });

  it("prevents invalid denominator in price formulas", () => {
    const calculator = new PriceCalculator();

    expect(() =>
      calculator.calculateSwapInput("100", "1000", "100", 1)
    ).toThrow();
  });
});

describe("Integration: Batch Builder", () => {
  const validAccountId = Keypair.random().publicKey();
  const sourceAccount = new Account(
    validAccountId,
    "1"
  );

  function mockContract(): any {
    return {
      call: (functionName: string, ...args: any[]) => ({ functionName, args }),
    };
  }

  it("rejects invalid fee multipliers", () => {
    expect(() =>
      new BatchTransactionBuilder(sourceAccount, { feeMultiplier: 0 })
    ).toThrow();
  });

  it("enforces maximum operation limit", () => {
    const builder = new BatchTransactionBuilder(sourceAccount);
    const contract = mockContract();

    for (let i = 0; i < 20; i++) {
      builder.addOperation(contract, "swap", ["to", true, "1", "2"], `op-${i}`);
    }

    expect(() => builder.addOperation(contract, "swap", ["to", true, "1", "2"]))
      .toThrow();
  });

  it("supports operation summaries and clear", () => {
    const builder = new BatchTransactionBuilder(sourceAccount);
    const contract = mockContract();

    builder
      .addSwap(contract, "to", true, "100", "101")
      .addWithdraw(contract, "to", "10", "1", "1");

    expect(builder.getOperationSummary()).toHaveLength(2);

    builder.clear();
    expect(builder.getOperationCount()).toBe(0);
  });
});
