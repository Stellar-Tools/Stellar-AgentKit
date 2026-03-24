import { createSimulator } from "../../../utils/simulate";
import type { SimulatorDeps } from "../../../utils/simulate";

// ── Mock server ───────────────────────────────────────────────────────────────
function makeDeps(simResult: unknown = { minResourceFee: "1000" }): SimulatorDeps {
  return {
    server: { simulateTransaction: vi.fn().mockResolvedValue(simResult) },
    network: "testnet",
    buildSwapTx: vi.fn().mockResolvedValue({ xdr: "mock-swap-tx" }),
    buildLpDepositTx: vi.fn().mockResolvedValue({ xdr: "mock-deposit-tx" }),
    buildLpWithdrawTx: vi.fn().mockResolvedValue({ xdr: "mock-withdraw-tx" }),
  };
}

// ── createSimulator shape ─────────────────────────────────────────────────────
describe("createSimulator", () => {
  it("returns swap, bridge, and lp properties", () => {
    const sim = createSimulator(makeDeps());
    expect(typeof sim.swap).toBe("function");
    expect(typeof sim.bridge).toBe("function");
    expect(typeof sim.lp.deposit).toBe("function");
    expect(typeof sim.lp.withdraw).toBe("function");
  });
});

// ── simulate.swap ─────────────────────────────────────────────────────────────
describe("simulate.swap", () => {
  it("returns success with fee when simulation succeeds", async () => {
    const sim = createSimulator(makeDeps({ minResourceFee: "5000" }));
    const result = await sim.swap({ to: "CPOOL", buyA: true, out: "100", inMax: "103" });
    expect(result.success).toBe(true);
    expect(result.estimatedFee).toBe("5000");
    expect(result.estimatedFeeXlm).toBe("0.0005000");
  });

  it("warns when slippage > 5%", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.swap({ to: "CPOOL", buyA: true, out: "100", inMax: "110" });
    expect(result.warnings.some(w => w.includes("slippage"))).toBe(true);
  });

  it("no slippage warning when slippage <= 5%", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.swap({ to: "CPOOL", buyA: true, out: "100", inMax: "103" });
    expect(result.warnings.filter(w => w.includes("slippage"))).toHaveLength(0);
  });

  it("returns error when buildSwapTx throws", async () => {
    const deps = makeDeps();
    (deps.buildSwapTx as any).mockRejectedValueOnce(new Error("Contract not found"));
    const sim = createSimulator(deps);
    const result = await sim.swap({ to: "CINVALID", buyA: true, out: "100", inMax: "100" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Contract not found/);
  });

  it("returns error when simulateTransaction returns error field", async () => {
    const deps = makeDeps({ error: "insufficient balance" });
    const sim = createSimulator(deps);
    const result = await sim.swap({ to: "CPOOL", buyA: true, out: "100", inMax: "100" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient/);
  });
});

// ── simulate.bridge ───────────────────────────────────────────────────────────
describe("simulate.bridge", () => {
  it("returns success for valid params", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "100", toAddress: "0x" + "a".repeat(40) });
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns failure for zero amount", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "0", toAddress: "0x" + "a".repeat(40) });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/positive/);
  });

  it("returns failure for invalid EVM address", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "10", toAddress: "not-evm" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/EVM/);
  });

  it("returns failure for empty toAddress", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "10", toAddress: "" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it("warns for large bridge amounts", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "99999", toAddress: "0x" + "a".repeat(40) });
    expect(result.warnings.some(w => w.includes("Large bridge"))).toBe(true);
  });

  it("warns on mainnet", async () => {
    const deps = { ...makeDeps(), network: "mainnet" as const };
    const sim = createSimulator(deps);
    const result = await sim.bridge({ amount: "10", toAddress: "0x" + "a".repeat(40) });
    expect(result.warnings.some(w => w.includes("mainnet"))).toBe(true);
  });

  it("returns N/A fee since cross-chain sim not available", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.bridge({ amount: "10", toAddress: "0x" + "a".repeat(40) });
    expect(result.estimatedFee).toBe("N/A");
  });
});

// ── simulate.lp.deposit ───────────────────────────────────────────────────────
describe("simulate.lp.deposit", () => {
  it("returns success with fee", async () => {
    const sim = createSimulator(makeDeps({ minResourceFee: "2000" }));
    const result = await sim.lp.deposit({ to: "CPOOL", desiredA: "100", minA: "98", desiredB: "200", minB: "196" });
    expect(result.success).toBe(true);
    expect(result.estimatedFee).toBe("2000");
  });

  it("warns when asset A slippage > 5%", async () => {
    const sim = createSimulator(makeDeps());
    const result = await sim.lp.deposit({ to: "CPOOL", desiredA: "100", minA: "80", desiredB: "200", minB: "180" });
    expect(result.warnings.some(w => w.includes("slippage"))).toBe(true);
  });

  it("returns error when buildLpDepositTx throws", async () => {
    const deps = makeDeps();
    (deps.buildLpDepositTx as any).mockRejectedValueOnce(new Error("Pool not found"));
    const sim = createSimulator(deps);
    const result = await sim.lp.deposit({ to: "CPOOL", desiredA: "100", minA: "95", desiredB: "200", minB: "190" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Pool not found/);
  });
});

// ── simulate.lp.withdraw ──────────────────────────────────────────────────────
describe("simulate.lp.withdraw", () => {
  it("returns success with fee", async () => {
    const sim = createSimulator(makeDeps({ minResourceFee: "1500" }));
    const result = await sim.lp.withdraw({ to: "CPOOL", shareAmount: "50", minA: "45", minB: "90" });
    expect(result.success).toBe(true);
    expect(result.estimatedFee).toBe("1500");
  });

  it("returns error when buildLpWithdrawTx throws", async () => {
    const deps = makeDeps();
    (deps.buildLpWithdrawTx as any).mockRejectedValueOnce(new Error("Insufficient shares"));
    const sim = createSimulator(deps);
    const result = await sim.lp.withdraw({ to: "CPOOL", shareAmount: "50", minA: "45", minB: "90" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Insufficient shares/);
  });
});
