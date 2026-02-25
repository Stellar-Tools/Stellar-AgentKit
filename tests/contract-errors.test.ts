/**
 * Contract and bridge error tests: invalid address (swap), mainnet bridge guard.
 */
import { swap } from "../lib/contract";
import { AgentKitErrorCode, isAgentKitError } from "../lib/errors";
import { bridgeTokenTool } from "../tools/bridge";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = () => (typeof (fn as () => Promise<void>)()?.then === "function" ? (fn as () => Promise<void>)() : Promise.resolve());
  return run()
    .then(() => {
      console.log(`✅ ${name}`);
      passed++;
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${name}\n   → ${msg}`);
      failed++;
    });
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null)
        throw new Error(`Expected value to be defined, got ${actual}`);
    },
  };
}

const validCaller = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";

Promise.all([
  test("swap with invalid address throws AgentKitError with INVALID_ADDRESS and context.to", async () => {
    try {
      await swap(validCaller, "invalid_address", true, "100", "200");
      throw new Error("Expected swap to throw");
    } catch (e) {
      expect(isAgentKitError(e)).toBe(true);
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_ADDRESS);
        expect(e.context).toBeDefined();
        expect(e.context!.to).toBe("invalid_address");
      }
    }
  }),

  test("swap with too-short address throws AgentKitError with INVALID_ADDRESS", async () => {
    try {
      await swap(validCaller, "G123", false, "1", "2");
      throw new Error("Expected swap to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_ADDRESS);
        expect(e.context!.to).toBe("G123");
      } else {
        throw e;
      }
    }
  }),

  test("bridge with stellar-mainnet without ALLOW_MAINNET_BRIDGE throws NETWORK_BLOCKED with context", async () => {
    const prev = process.env.ALLOW_MAINNET_BRIDGE;
    delete process.env.ALLOW_MAINNET_BRIDGE;
    try {
      const func = bridgeTokenTool.func as (input: {
        amount: string;
        toAddress: string;
        fromNetwork: string;
      }) => Promise<unknown>;
      await func({
        amount: "1",
        toAddress: "0x0000000000000000000000000000000000000001",
        fromNetwork: "stellar-mainnet",
      });
      throw new Error("Expected bridge to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.NETWORK_BLOCKED);
        expect(e.context!.network).toBe("stellar-mainnet");
        expect(e.context!.amount).toBe("1");
      } else {
        throw e;
      }
    } finally {
      if (prev !== undefined) process.env.ALLOW_MAINNET_BRIDGE = prev;
    }
  }),
]).then(() => {
  console.log(`\nContract errors tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
