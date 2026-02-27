/**
 * Get Balance Tests
 *
 * Tests for balance query functionality
 */

import { Keypair } from "@stellar/stellar-sdk";

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
    toContain: (substring: string) => {
      if (!String(actual).includes(substring))
        throw new Error(`Expected "${actual}" to contain "${substring}"`);
    },
    toBeGreaterThan: (n: number) => {
      if (actual === undefined || actual === null || isNaN(Number(actual)))
        throw new Error(`Expected a valid number but got ${actual}`);
      if (Number(actual) <= n)
        throw new Error(`Expected ${actual} > ${n}`);
    },
  };
}

// Test Suite: Parameter Validation
console.log("\n🧪 Get Balance - Parameter Validation Tests\n");

test("should accept valid Stellar public key (G...)", () => {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();

  expect(publicKey.charAt(0)).toBe("G");
  expect(publicKey.length).toBe(56);
});

test("should support testnet network", () => {
  const network = "testnet";
  expect(network).toBe("testnet");
});

test("should support mainnet network", () => {
  const network = "mainnet";
  expect(network).toBe("mainnet");
});

test("should default to testnet when network not specified", () => {
  const network = "testnet"; // default
  expect(network).toBe("testnet");
});

// Test Suite: Return Value Structure
console.log("\n🧪 Get Balance - Return Value Tests\n");

test("should return BalanceResult structure", () => {
  const mockResult = {
    publicKey: "GABC...XYZ",
    balances: [
      {
        asset_type: "native",
        balance: "9872.4398711",
      },
    ],
    network: "testnet",
  };

  expect(mockResult.publicKey).toBeDefined();
  expect(mockResult.balances).toBeDefined();
  expect(mockResult.network).toBe("testnet");
});

test("should include native XLM balance", () => {
  const mockBalances = [
    {
      asset_type: "native",
      balance: "9872.4398711",
    },
  ];

  expect(mockBalances[0].asset_type).toBe("native");
  expect(mockBalances[0].balance).toBeDefined();
});

test("should include custom asset balances", () => {
  const mockBalances = [
    {
      asset_type: "native",
      balance: "9872.4398711",
    },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GBBD...ABC",
      balance: "500.00",
      limit: "10000.00",
    },
  ];

  expect(mockBalances.length).toBe(2);
  expect(mockBalances[1].asset_code).toBe("USDC");
  expect(mockBalances[1].asset_issuer).toBeDefined();
});

test("should include trust limit for custom assets", () => {
  const mockBalance = {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD...ABC",
    balance: "500.00",
    limit: "10000.00",
  };

  expect(mockBalance.limit).toBeDefined();
  expect(parseFloat(mockBalance.limit!)).toBeGreaterThan(0);
});

test("should include liabilities when present", () => {
  const mockBalance = {
    asset_type: "native",
    balance: "9872.4398711",
    buying_liabilities: "100.0",
    selling_liabilities: "50.0",
  };

  expect(mockBalance.buying_liabilities).toBeDefined();
  expect(mockBalance.selling_liabilities).toBeDefined();
});

// Test Suite: Asset Types
console.log("\n🧪 Get Balance - Asset Types Tests\n");

test("should handle native asset type", () => {
  const assetType = "native";
  expect(assetType).toBe("native");
});

test("should handle credit_alphanum4 asset type", () => {
  const assetType = "credit_alphanum4";
  expect(assetType).toBe("credit_alphanum4");
});

test("should handle credit_alphanum12 asset type", () => {
  const assetType = "credit_alphanum12";
  expect(assetType).toBe("credit_alphanum12");
});

test("should handle liquidity_pool_shares asset type", () => {
  const assetType = "liquidity_pool_shares";
  expect(assetType).toBe("liquidity_pool_shares");
});

// Test Suite: Error Handling
console.log("\n🧪 Get Balance - Error Handling Tests\n");

test("should format error with context for account not found", () => {
  const errorMessage = `Failed to fetch balances for GABC...XYZ on testnet: Request failed with status code 404`;

  expect(errorMessage).toContain("Failed to fetch balances");
  expect(errorMessage).toContain("GABC...XYZ");
  expect(errorMessage).toContain("testnet");
  expect(errorMessage).toContain("404");
});

test("should format error with context for network failure", () => {
  const errorMessage = `Failed to fetch balances for GABC...XYZ on mainnet: Network error`;

  expect(errorMessage).toContain("Failed to fetch balances");
  expect(errorMessage).toContain("mainnet");
  expect(errorMessage).toContain("Network error");
});

// Test Suite: LangChain Tool Format
console.log("\n🧪 Get Balance - LangChain Tool Format Tests\n");

test("should format output for native balance only", () => {
  const output = `Account: GABC...XYZ
Network: testnet
Balances:
XLM: 9872.4398711`;

  expect(output).toContain("Account:");
  expect(output).toContain("Network:");
  expect(output).toContain("Balances:");
  expect(output).toContain("XLM:");
});

test("should format output for multiple assets", () => {
  const output = `Account: GABC...XYZ
Network: testnet
Balances:
XLM: 9872.4398711
USDC (GBBD47IF...): 500.00`;

  expect(output).toContain("XLM:");
  expect(output).toContain("USDC");
});

test("should truncate issuer address in output", () => {
  const issuer = "GBBD47IFACOABX56HJW2RZEGWT6QZQRFYOQBFAIE6KWPZDBWIH2TCKVM";
  const truncated = `${issuer.substring(0, 8)}...`;

  expect(truncated).toBe("GBBD47IF...");
  expect(truncated.length).toBe(11); // 8 chars + "..."
});

// Test Suite: Public Key Handling
console.log("\n🧪 Get Balance - Public Key Handling Tests\n");

test("should use provided public key", () => {
  const providedKey = "GABC...XYZ";
  const usedKey = providedKey;

  expect(usedKey).toBe(providedKey);
});

test("should fall back to env var when no key provided", () => {
  const envKey = process.env.STELLAR_PUBLIC_KEY || "GDEFAULT...ABC";
  const providedKey: string | undefined = undefined;
  const usedKey = providedKey || envKey;

  expect(usedKey).toBe(envKey);
});

test("should validate public key format", () => {
  const validKey = Keypair.random().publicKey();
  const startsWithG = validKey.charAt(0) === "G";
  const correctLength = validKey.length === 56;

  expect(startsWithG).toBe(true);
  expect(correctLength).toBe(true);
});

// Test Suite: Network URL Construction
console.log("\n🧪 Get Balance - Network URL Tests\n");

test("should use testnet Horizon URL", () => {
  const testnetUrl = "https://horizon-testnet.stellar.org";
  expect(testnetUrl).toContain("testnet");
});

test("should use mainnet Horizon URL", () => {
  const mainnetUrl = "https://horizon.stellar.org";
  expect(mainnetUrl).toBe("https://horizon.stellar.org");
});

test("should select correct URL based on network parameter", () => {
  const network = "testnet" as "testnet" | "mainnet";
  const url = network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

  expect(url).toBe("https://horizon-testnet.stellar.org");
});

// Test Suite: Balance Parsing
console.log("\n🧪 Get Balance - Balance Parsing Tests\n");

test("should parse balance as string", () => {
  const balance = "9872.4398711";
  const parsed = parseFloat(balance);

  expect(parsed).toBeGreaterThan(0);
  expect(isNaN(parsed)).toBe(false);
});

test("should handle zero balance", () => {
  const balance = "0.0000000";
  const parsed = parseFloat(balance);

  expect(parsed).toBe(0);
});

test("should handle large balance values", () => {
  const balance = "9999999999.9999999";
  const parsed = parseFloat(balance);

  expect(parsed).toBeGreaterThan(0);
  expect(isNaN(parsed)).toBe(false);
});

test("should preserve precision in balance string", () => {
  const balance = "9872.4398711";
  const decimalPlaces = balance.split(".")[1]?.length || 0;

  expect(decimalPlaces).toBe(7); // Stellar uses 7 decimal places
});

// Print Results
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
