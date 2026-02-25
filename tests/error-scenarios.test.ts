/**
 * Error scenario tests: mainnet guard, invalid address.
 */
import { AgentClient } from "../agent";

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
  await test("AgentClient mainnet without allowMainnet throws", async () => {
    try {
      new AgentClient({
        network: "mainnet",
        publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });
      throw new Error("Expected constructor to throw");
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      if (!e.message.includes("Mainnet") && !e.message.includes("allowMainnet"))
        throw new Error(`Expected mainnet safety message, got: ${e.message}`);
    }
  });

  await test("swap with invalid 'to' address throws", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: process.env.STELLAR_PUBLIC_KEY || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    try {
      await agent.swap({
        to: "invalid-address",
        buyA: true,
        out: "1",
        inMax: "1",
      });
      throw new Error("Expected swap to throw");
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      if (!e.message.includes("Invalid") && !e.message.includes("address"))
        throw new Error(`Expected invalid address error, got: ${e.message}`);
    }
  });

  await test("AgentClient testnet with allowMainnet does not throw", () => {
    new AgentClient({
      network: "testnet",
      allowMainnet: true,
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
  });

  console.log(`\nError scenarios: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
