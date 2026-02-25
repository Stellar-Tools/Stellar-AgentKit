/**
 * Lightweight integration tests: run against testnet when keys are available.
 * Skip in CI when STELLAR_PUBLIC_KEY is unset or the CI dummy (no real RPC needed).
 */
import { AgentClient } from "../agent";

const CI_DUMMY_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function shouldRunIntegration(): boolean {
  const key = process.env.STELLAR_PUBLIC_KEY;
  const explicit = process.env.RUN_INTEGRATION_TESTS === "1";
  return Boolean(key && key !== CI_DUMMY_KEY) || explicit;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${name}\n   → ${msg}`);
      failed++;
    }
  };
  return run();
}

async function run() {
  if (!shouldRunIntegration()) {
    console.log("⏭️  Integration tests skipped (set STELLAR_PUBLIC_KEY or RUN_INTEGRATION_TESTS=1 to run)");
    return;
  }

  const publicKey = process.env.STELLAR_PUBLIC_KEY || "";
  const agent = new AgentClient({ network: "testnet", publicKey });

  await test("testnet read: lp.getReserves() returns without throwing", async () => {
    const result = await agent.lp.getReserves();
    if (result !== undefined && result !== null && !Array.isArray(result)) {
      throw new Error(`Expected array or null, got ${typeof result}`);
    }
  });

  await test("testnet read: lp.getShareId() returns without throwing", async () => {
    const result = await agent.lp.getShareId();
    if (result !== undefined && result !== null && typeof result !== "string") {
      throw new Error(`Expected string or null, got ${typeof result}`);
    }
  });

  console.log(`\nIntegration: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
