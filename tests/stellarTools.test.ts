import { stellarSendPaymentTool } from "../tools/stellar";
import * as dotenv from "dotenv";

dotenv.config();

let passed = 0;
let failed = 0;

const VALID_PUB = "GCIJXBAWJ72KM2C6FDKFRYUGJC3AU75LZDODIWKDS2QLMQQEPBCKICUU5";
const VALID_SEC = "SCHACD52BC3UPDCWGGQNOTYOFEQP35HVP76EIKGS37O7655S3PCHEDH6";

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

function expect(actual: unknown, label?: string) {
  return {
    toContain: (sub: string) => {
      const act = String(actual).toLowerCase();
      const s = sub.toLowerCase();
      if (!act.includes(s)) {
        throw new Error(`${label || 'Value'} expected to contain "${sub}", got "${actual}"`);
      }
    },
  };
}

async function runTests() {
  console.log("Running Stellar Tools Tests...\n");

  await test("stellar_send_payment: invalid recipient", async () => {
    const result = await stellarSendPaymentTool.invoke({
      recipient: "bad-address",
      amount: "10",
    });
    expect(result, "Result").toContain("recipient address");
  });

  await test("stellar_send_payment: invalid amount (zero)", async () => {
    const result = await stellarSendPaymentTool.invoke({
      recipient: VALID_PUB,
      amount: "0",
    });
    expect(result, "Result").toContain("positive number");
  });

  await test("stellar_send_payment: invalid amount (negative)", async () => {
    const result = await stellarSendPaymentTool.invoke({
      recipient: VALID_PUB,
      amount: "-1",
    });
    expect(result, "Result").toContain("positive number");
  });

  await test("stellar_send_payment: non-numeric amount", async () => {
    const result = await stellarSendPaymentTool.invoke({
      recipient: VALID_PUB,
      amount: "abc",
    });
    expect(result, "Result").toContain("positive number");
  });

  await test("stellar_send_payment: missing private key", async () => {
    const oldKey = process.env.STELLAR_PRIVATE_KEY;
    delete process.env.STELLAR_PRIVATE_KEY;
    try {
      const result = await stellarSendPaymentTool.invoke({
        recipient: VALID_PUB,
        amount: "10",
      });
      expect(result, "Result").toContain("private key");
    } finally {
      process.env.STELLAR_PRIVATE_KEY = oldKey;
    }
  });

  console.log(`\nStellar Tools tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
