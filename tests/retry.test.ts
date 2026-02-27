import { withRetry } from "../utils/retry";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`❌ ${name}\n   → ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  };
  return run();
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
    },
  };
}

async function runTests() {
  console.log("Running Retry Utility Tests...\n");

  await test("withRetry: succeeds on first attempt", async () => {
    let callCount = 0;
    const result = await withRetry(async () => {
      callCount++;
      return "success";
    });
    expect(result).toBe("success");
    expect(callCount).toBe(1);
  });

  await test("withRetry: retries on retryable error and succeeds", async () => {
    let callCount = 0;
    const result = await withRetry(
      async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error("Network timeout");
        }
        return "success";
      },
      { initialDelayMs: 10, maxRetries: 3 }
    );
    expect(result).toBe("success");
    expect(callCount).toBe(3);
  });

  await test("withRetry: fails after max retries", async () => {
    let callCount = 0;
    try {
      await withRetry(
        async () => {
          callCount++;
          throw new Error("Rate limit exceeded");
        },
        { initialDelayMs: 10, maxRetries: 2 }
      );
      throw new Error("Should have thrown");
    } catch (e: any) {
      expect(e.message).toBe("Rate limit exceeded");
      expect(callCount).toBe(3); // 1 original + 2 retries
    }
  });

  await test("withRetry: fails immediately on non-retryable error", async () => {
    let callCount = 0;
    try {
      await withRetry(
        async () => {
          callCount++;
          throw new Error("Invalid parameters");
        },
        { initialDelayMs: 10, maxRetries: 3 }
      );
      throw new Error("Should have thrown");
    } catch (e: any) {
      expect(e.message).toBe("Invalid parameters");
      expect(callCount).toBe(1);
    }
  });

  console.log(`\nRetry Utility tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
