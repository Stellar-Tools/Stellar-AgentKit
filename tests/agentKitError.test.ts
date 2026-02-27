/**
 * AgentKitError integration: swap invalid address, LP tool missing params, bridge mainnet guard.
 */
import { AgentClient } from "../agent";
import { AgentKitError, AgentKitErrorCode } from "../lib/errors";
import * as contractTool from "../tools/contract";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const nameAttr = (e as any).name || "Unknown";
      console.log(`❌ ${name}\n   → [${nameAttr}] ${msg}`);
      if (e instanceof Error && e.stack && !msg.includes("Expected")) {
          console.log(e.stack);
      }
      failed++;
    }
  };
  return run();
}

function expect(actual: unknown, label?: string) {
  return {
    toBeDefined: () => {
      if (actual === undefined || actual === null)
        throw new Error(`${label || 'Value'} expected to be defined, got ${actual}`);
    },
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`${label || 'Value'} expected ${expected}, got ${actual}`);
    },
    toContain: (sub: string) => {
      if (typeof actual !== "string" || !actual.includes(sub))
        throw new Error(`${label || 'String'} expected to contain "${sub}", got ${actual}`);
    },
  };
}

async function runTests() {
  await test("swap with invalid address throws AgentKitError with code INVALID_ADDRESS and context", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    try {
      await agent.swap({
        to: "invalid-address",
        buyA: true,
        out: "100",
        inMax: "110",
      });
      throw new Error("Expected swap to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.INVALID_ADDRESS);
      expect(err.context, "Error context").toBeDefined();
      expect(err.message.toLowerCase(), "Error message").toContain("address format");
    }
  });

  await test("swap with invalid address includes to in context", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    try {
      await agent.swap({ to: "bad", buyA: false, out: "1", inMax: "2" });
      throw new Error("Expected swap to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.INVALID_ADDRESS);
      expect(err.context, "Error context").toBeDefined();
      expect(err.context!.to, "Context 'to'").toBe("bad");
    }
  });

  await test("LP tool swap with missing inMax throws AgentKitError TOOL_EXECUTION_FAILED", async () => {
    try {
      await contractTool.StellarLiquidityContractTool.invoke({
        action: "swap",
        to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        buyA: true,
        out: "100",
      });
      throw new Error("Expected tool to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.TOOL_EXECUTION_FAILED);
    }
  });

  await test("LP tool deposit with missing params throws AgentKitError TOOL_EXECUTION_FAILED", async () => {
    try {
      await contractTool.StellarLiquidityContractTool.invoke({
        action: "deposit",
        to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        desiredA: "10",
        minA: "9",
        desiredB: "10",
      });
      throw new Error("Expected tool to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.TOOL_EXECUTION_FAILED);
    }
  });

  await test("stake.getStake with invalid address throws AgentKitError INVALID_ADDRESS", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    try {
      await agent.stake.getStake("bad");
      throw new Error("Expected stake.getStake to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.INVALID_ADDRESS);
      expect(err.context, "Error context").toBeDefined();
      expect(err.context!.to, "Context 'to'").toBe("bad");
    }
  });

  await test("LP tool deposit with missing minA throws AgentKitError TOOL_EXECUTION_FAILED", async () => {
    try {
      await contractTool.StellarLiquidityContractTool.invoke({
        action: "deposit",
        to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        desiredA: "10",
        desiredB: "10",
        minB: "9",
      });
      throw new Error("Expected tool to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.TOOL_EXECUTION_FAILED);
    }
  });

  await test("bridge on mainnet without ALLOW_MAINNET_BRIDGE throws AgentKitError NETWORK_BLOCKED", async () => {
    const prev = process.env.ALLOW_MAINNET_BRIDGE;
    process.env.ALLOW_MAINNET_BRIDGE = "";
    const agent = new AgentClient({
      network: "mainnet",
      allowMainnet: true,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    try {
      await agent.bridge({ amount: "10", toAddress: "0x123" });
      throw new Error("Expected bridge to throw");
    } catch (e) {
      const err = e as AgentKitError;
      expect(err.name === "AgentKitError", "Error name").toBe(true);
      expect(err.code, "Error code").toBe(AgentKitErrorCode.NETWORK_BLOCKED);
      expect(err.context, "Error context").toBeDefined();
      expect(err.context!.network, "Context network").toBe("stellar-mainnet");
      expect(err.context!.amount, "Context amount").toBe("10");
    } finally {
      process.env.ALLOW_MAINNET_BRIDGE = prev;
    }
  });

  console.log(`\nAgentKitError tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
