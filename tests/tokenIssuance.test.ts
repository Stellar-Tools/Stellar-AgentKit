/**
 * Token issuance tests: validation, mainnet safeguard, and AgentKitError.
 * Uses lib/tokenIssuance (symbol, initialSupply, enum AgentKitErrorCode).
 */

import { launchToken } from "../lib/tokenIssuance";
import { AgentKitErrorCode, isAgentKitError } from "../lib/errors";
import { AgentClient } from "../agent";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    const p = fn();
    if (p && typeof (p as Promise<void>).then === "function") {
      await (p as Promise<void>);
    }
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}\n   → ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null)
        throw new Error(`Expected defined, got ${actual}`);
    },
  };
}

const fakeIssuerPub = "G" + "A".repeat(55);
const fakeDistributorPub = "G" + "B".repeat(55);

(async () => {
  await test("launchToken with invalid asset code throws VALIDATION", async () => {
    try {
      await launchToken({
        symbol: "",
        initialSupply: "1000",
        issuerSecretKey: "S" + "A".repeat(55),
        distributorPublicKey: fakeDistributorPub,
        distributorSecretKey: "S" + "B".repeat(55),
        network: "testnet",
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      expect(isAgentKitError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(AgentKitErrorCode.VALIDATION);
    }
  });

  await test("launchToken with invalid address throws INVALID_ADDRESS", async () => {
    try {
      await launchToken({
        symbol: "TEST",
        initialSupply: "1000",
        issuerSecretKey: "S" + "A".repeat(55),
        distributorPublicKey: "not-an-address",
        distributorSecretKey: "S" + "B".repeat(55),
        network: "testnet",
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      expect(isAgentKitError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(AgentKitErrorCode.INVALID_ADDRESS);
    }
  });

  await test("launchToken with invalid supply throws INVALID_SUPPLY", async () => {
    try {
      await launchToken({
        symbol: "TEST",
        issuerSecretKey: "S" + "A".repeat(55),
        distributorPublicKey: fakeDistributorPub,
        distributorSecretKey: "S" + "B".repeat(55),
        network: "testnet",
        initialSupply: "0",
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      expect(isAgentKitError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(AgentKitErrorCode.INVALID_SUPPLY);
    }
  });

  await test("launchToken on mainnet without ALLOW_MAINNET_TOKEN_ISSUANCE throws NETWORK_BLOCKED", async () => {
    const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
    delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
    try {
      await launchToken({
        symbol: "TEST",
        initialSupply: "1000",
        issuerSecretKey: "S" + "A".repeat(55),
        distributorPublicKey: fakeDistributorPub,
        distributorSecretKey: "S" + "B".repeat(55),
        network: "mainnet",
        allowMainnetTokenIssuance: false,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      expect(isAgentKitError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(AgentKitErrorCode.NETWORK_BLOCKED);
    } finally {
      if (prev !== undefined) process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
    }
  });

  await test("AgentClient.launchToken exists and accepts params", () => {
    const client = new AgentClient({
      network: "testnet",
      publicKey: fakeIssuerPub,
    });
    expect(typeof client.launchToken).toBe("function");
    expect(client.launchToken).toBeDefined();
  });

  console.log("\n--- Token issuance test summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) throw new Error(`${failed} test(s) failed`);
})();
