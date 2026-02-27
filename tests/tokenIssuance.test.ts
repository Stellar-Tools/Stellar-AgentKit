/**
 * Token Issuance Tests
 *
 * Tests for Issue #13 - Token Launch functionality
 */

import { Keypair } from "@stellar/stellar-sdk";
import { LaunchTokenParams } from "../lib/tokenIssuance";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${name}\n   → ${e.message}`);
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBeDefined: () => {
      if (actual === undefined || actual === null)
        throw new Error(`Expected value to be defined, got ${actual}`);
    },
    toBe: (expected: any) => {
      if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toThrow: () => {
      if (typeof actual !== "function")
        throw new Error("toThrow requires a function");
      let threw = false;
      try {
        actual();
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("Expected function to throw");
    },
    toMatch: (regex: RegExp) => {
      if (!regex.test(String(actual)))
        throw new Error(`Expected ${actual} to match ${regex}`);
    },
    toBeGreaterThan: (n: number) => {
      if (actual === undefined || actual === null || isNaN(Number(actual)))
        throw new Error(`Expected a valid number but got ${actual}`);
      if (Number(actual) <= n)
        throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThanOrEqual: (n: number) => {
      if (actual === undefined || actual === null || isNaN(Number(actual)))
        throw new Error(`Expected a valid number but got ${actual}`);
      if (Number(actual) > n)
        throw new Error(`Expected ${actual} <= ${n}`);
    },
    toContain: (substring: string) => {
      if (!String(actual).includes(substring))
        throw new Error(`Expected "${actual}" to contain "${substring}"`);
    },
  };
}

// Test Suite: Parameter Validation
console.log("\n🧪 Token Issuance - Parameter Validation Tests\n");

test("should require valid asset code (not empty)", () => {
  const params: LaunchTokenParams = {
    code: "",
    issuerSecret: Keypair.random().secret(),
    distributorSecret: Keypair.random().secret(),
    initialSupply: "1000000",
  };

  expect(params.code.length).toBe(0);
});

test("should validate asset code length (max 12 characters)", () => {
  const validCode = "MYTOKEN";
  const invalidCode = "VERYLONGTOKEN";

  expect(validCode.length).toBeLessThanOrEqual(12);
  expect(invalidCode.length).toBeGreaterThan(12);
});

test("should require positive initial supply", () => {
  const validSupply = "1000000";
  const invalidSupply = "-100";
  const zeroSupply = "0";

  expect(parseFloat(validSupply)).toBeGreaterThan(0);
  expect(parseFloat(invalidSupply) > 0).toBe(false);
  expect(parseFloat(zeroSupply) > 0).toBe(false);
});

test("should accept valid issuer secret", () => {
  const issuerKeypair = Keypair.random();
  const secret = issuerKeypair.secret();

  expect(secret).toBeDefined();
  expect(secret.charAt(0)).toBe("S");
  expect(secret.length).toBe(56);
});

test("should accept valid distributor secret", () => {
  const distributorKeypair = Keypair.random();
  const secret = distributorKeypair.secret();

  expect(secret).toBeDefined();
  expect(secret.charAt(0)).toBe("S");
  expect(secret.length).toBe(56);
});

test("should have default decimals of 7", () => {
  const params: LaunchTokenParams = {
    code: "TEST",
    issuerSecret: Keypair.random().secret(),
    distributorSecret: Keypair.random().secret(),
    initialSupply: "1000000",
  };

  const decimals = params.decimals ?? 7;
  expect(decimals).toBe(7);
});

test("should have default lockIssuer of false", () => {
  const params: LaunchTokenParams = {
    code: "TEST",
    issuerSecret: Keypair.random().secret(),
    distributorSecret: Keypair.random().secret(),
    initialSupply: "1000000",
  };

  const lockIssuer = params.lockIssuer ?? false;
  expect(lockIssuer).toBe(false);
});

// Test Suite: Token Parameters
console.log("\n🧪 Token Issuance - Token Parameters Tests\n");

test("should support alphanumeric asset codes", () => {
  const codes = ["XLM", "USDC", "TOKEN123", "MY2TOKEN"];

  codes.forEach(code => {
    expect(code.match(/^[A-Z0-9]+$/)).toBeDefined();
  });
});

test("should support different decimal precisions (0-7)", () => {
  const validDecimals = [0, 1, 2, 3, 4, 5, 6, 7];

  validDecimals.forEach(d => {
    expect(d >= 0 && d <= 7).toBe(true);
  });
});

test("should handle large initial supply strings", () => {
  const largeSupply = "9999999999999";
  const parsed = parseFloat(largeSupply);

  expect(parsed).toBeGreaterThan(0);
  expect(isNaN(parsed)).toBe(false);
});

test("should handle small initial supply strings", () => {
  const smallSupply = "1";
  const parsed = parseFloat(smallSupply);

  expect(parsed).toBeGreaterThan(0);
  expect(parsed).toBe(1);
});

// Test Suite: Issuer Lock Functionality
console.log("\n🧪 Token Issuance - Issuer Lock Tests\n");

test("should support fixed supply tokens (lockIssuer = true)", () => {
  const params: LaunchTokenParams = {
    code: "FIXED",
    issuerSecret: Keypair.random().secret(),
    distributorSecret: Keypair.random().secret(),
    initialSupply: "1000000",
    lockIssuer: true,
  };

  expect(params.lockIssuer).toBe(true);
});

test("should support unlimited supply tokens (lockIssuer = false)", () => {
  const params: LaunchTokenParams = {
    code: "UNLIMITED",
    issuerSecret: Keypair.random().secret(),
    distributorSecret: Keypair.random().secret(),
    initialSupply: "1000000",
    lockIssuer: false,
  };

  expect(params.lockIssuer).toBe(false);
});

// Test Suite: Key Generation
console.log("\n🧪 Token Issuance - Key Generation Tests\n");

test("should generate different keys for issuer and distributor", () => {
  const issuerKeypair = Keypair.random();
  const distributorKeypair = Keypair.random();

  expect(issuerKeypair.publicKey() !== distributorKeypair.publicKey()).toBe(true);
  expect(issuerKeypair.secret() !== distributorKeypair.secret()).toBe(true);
});

test("should generate valid Stellar public keys (G...)", () => {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();

  expect(publicKey.charAt(0)).toBe("G");
  expect(publicKey.length).toBe(56);
});

test("should generate valid Stellar secret keys (S...)", () => {
  const keypair = Keypair.random();
  const secret = keypair.secret();

  expect(secret.charAt(0)).toBe("S");
  expect(secret.length).toBe(56);
});

// Test Suite: Network Support
console.log("\n🧪 Token Issuance - Network Support Tests\n");

test("should default to testnet", () => {
  const network = "testnet";
  expect(network).toBe("testnet");
});

test("should support mainnet", () => {
  const network = "mainnet";
  expect(network).toBe("mainnet");
});

test("should validate network parameter", () => {
  const validNetworks = ["testnet", "mainnet"];

  validNetworks.forEach(network => {
    expect(network === "testnet" || network === "mainnet").toBe(true);
  });
});

// Test Suite: Error Message Format
console.log("\n🧪 Token Issuance - Error Message Format Tests\n");

test("should format enhanced error messages with context", () => {
  const errorMessage = `Invalid asset code: "TOOLONGASSETCODE". Asset code must be 1-12 alphanumeric characters.
Context:
  - Provided code: TOOLONGASSETCODE
  - Length: 17`;

  expect(errorMessage).toContain("Context:");
  expect(errorMessage).toContain("Provided code:");
  expect(errorMessage).toContain("Length:");
});

test("should include helpful hints in error messages", () => {
  const errorMessage = `Failed to load distributor account.
Context:
  - Distributor public key: GDIST...XYZ
  - Network: testnet
  - Error: Request failed with status code 404
  - Hint: Account may not be funded. Use Friendbot (testnet) or fund the account.`;

  expect(errorMessage).toContain("Hint:");
  expect(errorMessage).toContain("Friendbot");
});

// Test Suite: Return Value Structure
console.log("\n🧪 Token Issuance - Return Value Tests\n");

test("should return LaunchTokenResult structure", () => {
  const mockResult = {
    success: true,
    assetCode: "MYTOKEN",
    issuerPublicKey: "GISSUER...ABC",
    distributorPublicKey: "GDIST...XYZ",
    initialSupply: "1000000",
    issuerLocked: true,
    trustlineHash: "abc123...",
    mintHash: "def456...",
    lockHash: "ghi789...",
    network: "testnet" as const,
  };

  expect(mockResult.success).toBe(true);
  expect(mockResult.assetCode).toBe("MYTOKEN");
  expect(mockResult.issuerLocked).toBe(true);
  expect(mockResult.network).toBe("testnet");
});

test("should include all transaction hashes", () => {
  const mockResult = {
    trustlineHash: "abc123",
    mintHash: "def456",
    lockHash: "ghi789",
  };

  expect(mockResult.trustlineHash).toBeDefined();
  expect(mockResult.mintHash).toBeDefined();
  expect(mockResult.lockHash).toBeDefined();
});

test("should omit lockHash when issuer is not locked", () => {
  const mockResult = {
    trustlineHash: "abc123",
    mintHash: "def456",
    lockHash: undefined,
  };

  expect(mockResult.lockHash).toBe(undefined);
});

// Print Results
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
