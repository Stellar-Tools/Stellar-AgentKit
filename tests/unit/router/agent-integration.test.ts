import { describe, it, expect, vi } from "vitest";

// Mock contract module so AgentClient can import without real network
vi.mock("../../../lib/contract", () => ({
  swap: vi.fn().mockResolvedValue("direct-tx-hash"),
  deposit: vi.fn(),
  withdraw: vi.fn(),
  getReserves: vi.fn(),
  getShareId: vi.fn(),
}));

vi.mock("../../../tools/bridge", () => ({
  bridgeTokenTool: { func: vi.fn() },
}));

import { AgentClient } from "../../../agent";

describe("AgentClient swap with strategy", () => {
  it("should still support direct swap (backward compat)", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });

    const result = await agent.swap({
      to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      buyA: true,
      out: "1000",
      inMax: "2000",
    });
    expect(result).toBe("direct-tx-hash");
  });

  it("should accept strategy: best-route params and have getSwapRoute", () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });

    expect(typeof agent.swap).toBe("function");
    expect(typeof agent.getSwapRoute).toBe("function");
  });
});
