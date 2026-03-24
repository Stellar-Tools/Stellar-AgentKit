import { TransactionMetrics } from "../../../utils/metrics";

describe("TransactionMetrics", () => {
  let metrics: TransactionMetrics;

  beforeEach(() => {
    metrics = new TransactionMetrics();
  });

  describe("track", () => {
    it("records a successful swap", () => {
      const finish = metrics.track("swap");
      finish({ success: true, inputAmount: "100", outputAmount: "95", slippagePct: 5 });
      expect(metrics.history()).toHaveLength(1);
      expect(metrics.history()[0].type).toBe("swap");
      expect(metrics.history()[0].success).toBe(true);
    });

    it("records a failed bridge", () => {
      const finish = metrics.track("bridge");
      finish({ success: false, errorMessage: "Timeout" });
      expect(metrics.history()[0].success).toBe(false);
      expect(metrics.history()[0].errorMessage).toBe("Timeout");
    });

    it("records duration", async () => {
      const finish = metrics.track("swap");
      await new Promise((r) => setTimeout(r, 10));
      const record = finish({ success: true });
      expect(record.durationMs).toBeGreaterThanOrEqual(10);
    });

    it("assigns unique IDs", () => {
      const f1 = metrics.track("swap");
      const f2 = metrics.track("swap");
      const r1 = f1({ success: true });
      const r2 = f2({ success: true });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe("summary", () => {
    it("returns zeroed summary when no records", () => {
      const s = metrics.summary();
      expect(s.totalTransactions).toBe(0);
      expect(s.successRate).toBe("0.00%");
      expect(s.totalVolume).toBe("0.0000000");
    });

    it("calculates success rate correctly", () => {
      const f1 = metrics.track("swap");
      f1({ success: true, inputAmount: "100" });
      const f2 = metrics.track("swap");
      f2({ success: false });
      const s = metrics.summary();
      expect(s.successCount).toBe(1);
      expect(s.failureCount).toBe(1);
      expect(s.successRate).toBe("50.00%");
    });

    it("calculates total volume from inputAmount", () => {
      const f1 = metrics.track("swap");
      f1({ success: true, inputAmount: "100" });
      const f2 = metrics.track("lp_deposit");
      f2({ success: true, inputAmount: "200" });
      expect(metrics.summary().totalVolume).toBe("300.0000000");
    });

    it("calculates avgSlippage only from successful records", () => {
      const f1 = metrics.track("swap");
      f1({ success: true, slippagePct: 1.0 });
      const f2 = metrics.track("swap");
      f2({ success: true, slippagePct: 3.0 });
      const f3 = metrics.track("swap");
      f3({ success: false, slippagePct: 99.0 }); // should be excluded
      expect(metrics.summary().avgSlippage).toBe("2.00%");
    });

    it("counts byType correctly", () => {
      metrics.track("swap")({ success: true });
      metrics.track("swap")({ success: false });
      metrics.track("bridge")({ success: true });
      const s = metrics.summary();
      expect(s.byType.swap.count).toBe(2);
      expect(s.byType.swap.successCount).toBe(1);
      expect(s.byType.bridge.count).toBe(1);
      expect(s.byType.lp_deposit.count).toBe(0);
    });
  });

  describe("byType", () => {
    it("filters records by operation type", () => {
      metrics.track("swap")({ success: true });
      metrics.track("bridge")({ success: true });
      metrics.track("swap")({ success: false });
      expect(metrics.byType("swap")).toHaveLength(2);
      expect(metrics.byType("bridge")).toHaveLength(1);
      expect(metrics.byType("lp_withdraw")).toHaveLength(0);
    });
  });

  describe("recent", () => {
    it("returns last N records", () => {
      for (let i = 0; i < 15; i++) {
        metrics.track("swap")({ success: true, inputAmount: String(i) });
      }
      expect(metrics.recent(5)).toHaveLength(5);
      expect(metrics.recent(5)[4].inputAmount).toBe("14");
    });
  });

  describe("clear", () => {
    it("resets all records and counter", () => {
      metrics.track("swap")({ success: true });
      metrics.clear();
      expect(metrics.history()).toHaveLength(0);
      expect(metrics.summary().totalTransactions).toBe(0);
    });
  });
});
