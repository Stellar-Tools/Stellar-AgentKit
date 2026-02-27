/**
 * Token issuance (launchToken) tests: validation, mainnet guard, error codes (value import).
 */
declare const process: { env: Record<string, string | undefined>; exit: (code: number) => never };

import { launchToken } from "../lib/launchToken";
import { AgentKitError, AgentKitErrorCode, isAgentKitError } from "../lib/errors";

const validIssuerSecret =
  "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE2R";
const validDistributorPubkey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
  };
}

async function main() {
  // Mainnet without opt-in -> NETWORK_BLOCKED
  const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
  delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
  try {
    await launchToken({
      network: "mainnet",
      allowMainnetTokenIssuance: false,
      symbol: "TEST",
      initialSupply: "100",
      issuerSecretKey: validIssuerSecret,
      distributorPublicKey: validDistributorPubkey,
    });
    throw new Error("Expected throw");
  } catch (e) {
    if (isAgentKitError(e)) expect(e.code).toBe(AgentKitErrorCode.NETWORK_BLOCKED);
    else throw e;
  } finally {
    if (prev !== undefined) process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
  }

  // Mainnet with allowMainnet but no env -> NETWORK_BLOCKED
  delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
  try {
    await launchToken({
      network: "mainnet",
      allowMainnetTokenIssuance: true,
      symbol: "TEST",
      initialSupply: "100",
      issuerSecretKey: validIssuerSecret,
      distributorPublicKey: validDistributorPubkey,
    });
    throw new Error("Expected throw");
  } catch (e) {
    if (isAgentKitError(e)) expect(e.code).toBe(AgentKitErrorCode.NETWORK_BLOCKED);
    else throw e;
  } finally {
    if (prev !== undefined) process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
  }

  // Invalid decimals -> INVALID_DECIMALS (not VALIDATION in our tokenIssuance)
  try {
    await launchToken({
      network: "testnet",
      symbol: "TEST",
      decimals: 10,
      initialSupply: "100",
      issuerSecretKey: validIssuerSecret,
      distributorPublicKey: validDistributorPubkey,
    });
    throw new Error("Expected throw");
  } catch (e) {
    if (isAgentKitError(e)) expect(e.code).toBe(AgentKitErrorCode.INVALID_DECIMALS);
    else throw e;
  }

  // Zero supply -> INVALID_SUPPLY
  try {
    await launchToken({
      network: "testnet",
      symbol: "TEST",
      initialSupply: "0",
      issuerSecretKey: validIssuerSecret,
      distributorPublicKey: validDistributorPubkey,
    });
    throw new Error("Expected throw");
  } catch (e) {
    if (isAgentKitError(e)) expect(e.code).toBe(AgentKitErrorCode.INVALID_SUPPLY);
    else throw e;
  }

  // Invalid symbol -> INVALID_ADDRESS
  try {
    await launchToken({
      network: "testnet",
      symbol: "INVALID_SYMBOL_TOO_LONG_XXX",
      initialSupply: "100",
      issuerSecretKey: validIssuerSecret,
      distributorPublicKey: validDistributorPubkey,
    });
    throw new Error("Expected throw");
  } catch (e) {
    if (isAgentKitError(e)) expect(e.code).toBe(AgentKitErrorCode.INVALID_ADDRESS);
    else throw e;
  }

  // AgentKitError 4-arg constructor
  const err = new AgentKitError(
    AgentKitErrorCode.VALIDATION,
    "test",
    { symbol: "X" },
    new Error("cause")
  );
  expect(err.code).toBe(AgentKitErrorCode.VALIDATION);

  console.log("✅ launchToken.test.ts passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
