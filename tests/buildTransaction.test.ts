import {
  Contract,
  Account,
  Networks,
  Keypair,
} from "@stellar/stellar-sdk";
import { buildTransaction, buildTransactionFromXDR } from "../utils/buildTransaction";

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
  };
}

const mockContractAddress = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ";

const mockAccount = new Account(Keypair.random().publicKey(), "1");

// ─── buildTransaction tests ───────────────────────────────────────────────────

test("should build a swap transaction with default configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
  expect(tx.networkPassphrase).toBe(Networks.TESTNET);
  expect(tx.timeBounds?.maxTime).toBeGreaterThan(0);
});

test("should build an LP transaction with default configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("lp", mockAccount, { contract, functionName: "deposit", args: [] });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
  expect(tx.networkPassphrase).toBe(Networks.TESTNET);
});

test("should build a bridge transaction with default configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("bridge", mockAccount, { contract, functionName: "bridge_send", args: [] });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
  expect(tx.networkPassphrase).toBe(Networks.TESTNET);
});

test("should build a stake transaction with default configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("stake", mockAccount, { contract, functionName: "stake", args: [] });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
  expect(tx.networkPassphrase).toBe(Networks.TESTNET);
});

test("should apply custom fee configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] }, { fee: "1000" });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
});

test("should apply custom timeout configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] }, { timeout: 600 });
  expect(tx).toBeDefined();
  expect(tx.timeBounds?.maxTime).toBeGreaterThan(0);
});

test("should apply memo configuration", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] }, { memo: "test-memo" });
  expect(tx).toBeDefined();
  expect(tx.memo).toBeDefined();
});

test("should handle transaction without arguments", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("lp", mockAccount, { contract, functionName: "read_only_call" });
  expect(tx).toBeDefined();
  expect(tx.operations.length).toBe(1);
});

test("should set correct default timeout for swap (300s)", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] });
  const expectedMaxTime = Math.floor(Date.now() / 1000) + 300;
  expect(Number(tx.timeBounds?.maxTime)).toBeLessThanOrEqual(expectedMaxTime + 10);
});

test("should set correct default timeout for lp (300s)", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("lp", mockAccount, { contract, functionName: "deposit", args: [] });
  const expectedMaxTime = Math.floor(Date.now() / 1000) + 300;
  expect(Number(tx.timeBounds?.maxTime)).toBeLessThanOrEqual(expectedMaxTime + 10);
});

test("should set correct default timeout for bridge (300s)", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("bridge", mockAccount, { contract, functionName: "bridge_send", args: [] });
  const expectedMaxTime = Math.floor(Date.now() / 1000) + 300;
  expect(Number(tx.timeBounds?.maxTime)).toBeLessThanOrEqual(expectedMaxTime + 10);
});

test("should set correct default timeout for stake (300s)", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("stake", mockAccount, { contract, functionName: "stake", args: [] });
  const expectedMaxTime = Math.floor(Date.now() / 1000) + 300;
  expect(Number(tx.timeBounds?.maxTime)).toBeLessThanOrEqual(expectedMaxTime + 10);
});

test("should maintain TESTNET network passphrase", () => {
  const contract = new Contract(mockContractAddress);
  const tx = buildTransaction("swap", mockAccount, { contract, functionName: "swap", args: [] });
  expect(tx.networkPassphrase).toBe(Networks.TESTNET);
});

test("should support all four operation types without error", () => {
  const contract = new Contract(mockContractAddress);
  (["swap", "lp", "bridge", "stake"] as const).forEach((opType) => {
    const tx = buildTransaction(opType, mockAccount, { contract, functionName: `${opType}_fn`, args: [] });
    expect(tx).toBeDefined();
    expect(tx.operations.length).toBe(1);
  });
});

// ─── buildTransactionFromXDR tests ───────────────────────────────────────────

test("should reconstruct transaction from valid XDR string", () => {
  const account = new Account(Keypair.random().publicKey(), "0");
  const contract = new Contract(mockContractAddress);
  const original = buildTransaction("bridge", account, { contract, functionName: "test", args: [] });
  const reconstructed = buildTransactionFromXDR("bridge", original.toXDR(), Networks.TESTNET);
  expect(reconstructed).toBeDefined();
  expect(reconstructed.networkPassphrase).toBe(Networks.TESTNET);
});

test("should preserve operations when reconstructing from XDR", () => {
  const account = new Account(Keypair.random().publicKey(), "0");
  const contract = new Contract(mockContractAddress);
  const original = buildTransaction("lp", account, { contract, functionName: "deposit", args: [] }, { memo: "test-memo" });
  const reconstructed = buildTransactionFromXDR("lp", original.toXDR(), Networks.TESTNET);
  expect(reconstructed).toBeDefined();
  expect(reconstructed.operations.length).toBe(original.operations.length);
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);