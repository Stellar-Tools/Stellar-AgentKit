/**
 * Token issuance tests: mainnet safeguard, validation (decimals, supply), and error codes.
 * Does not require live testnet (validation and mainnet guard only).
 */

declare const process: { env: Record<string, string | undefined>; exit: (code: number) => never };

import { launchToken } from "../lib/tokenIssuance";
import { AgentKitErrorCode, isAgentKitError } from "../lib/errors";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  const run = () => {
    const result = fn();
    return result instanceof Promise ? result : Promise.resolve();
  };
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
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null)
        throw new Error(`Expected value to be defined, got ${actual}`);
    },
  };
}

const validIssuerSecret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE2R";
const validDistributorPubkey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";

Promise.all([
  test("launchToken on mainnet without allowMainnetTokenIssuance throws NETWORK_BLOCKED", async () => {
    const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
    delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
    try {
      await launchToken({
        network: "mainnet",
        allowMainnetTokenIssuance: false,
        symbol: "TEST",
        initialSupply: "100.0000000",
        issuerSecretKey: validIssuerSecret,
        distributorPublicKey: validDistributorPubkey,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.NETWORK_BLOCKED);
        expect(e.context?.network).toBe("mainnet");
      } else throw e;
    } finally {
      if (prev !== undefined) process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
    }
  }),

  test("launchToken with invalid decimals throws INVALID_DECIMALS", async () => {
    try {
      await launchToken({
        network: "testnet",
        symbol: "TEST",
        decimals: 10,
        initialSupply: "100",
        issuerSecretKey: validIssuerSecret,
        distributorPublicKey: validDistributorPubkey,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_DECIMALS);
        expect(e.context?.decimals).toBe(10);
      } else throw e;
    }
  }),

  test("launchToken with zero initialSupply throws INVALID_SUPPLY", async () => {
    try {
      await launchToken({
        network: "testnet",
        symbol: "TEST",
        initialSupply: "0",
        issuerSecretKey: validIssuerSecret,
        distributorPublicKey: validDistributorPubkey,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_SUPPLY);
      } else throw e;
    }
  }),

  test("launchToken with negative supply throws INVALID_SUPPLY", async () => {
    try {
      await launchToken({
        network: "testnet",
        symbol: "TEST",
        initialSupply: "-100",
        issuerSecretKey: validIssuerSecret,
        distributorPublicKey: validDistributorPubkey,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_SUPPLY);
      } else throw e;
    }
  }),

  test("launchToken with invalid symbol (too long) throws", async () => {
    try {
      await launchToken({
        network: "testnet",
        symbol: "INVALID_SYMBOL_TOO_LONG",
        initialSupply: "100",
        issuerSecretKey: validIssuerSecret,
        distributorPublicKey: validDistributorPubkey,
      });
      throw new Error("Expected launchToken to throw");
    } catch (e) {
      if (isAgentKitError(e)) {
        expect(e.code).toBe(AgentKitErrorCode.INVALID_ADDRESS);
      } else throw e;
    }
  }),
]).then(() => {
  console.log(`\nToken issuance tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
