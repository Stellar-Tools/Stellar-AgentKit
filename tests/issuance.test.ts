/**
 * Token issuance tests: mainnet safeguard, invalid params.
 */
import { AgentClient } from "../index";
import { AgentKitError, AgentKitErrorCode } from "../lib/errors";

let passed = 0;
let failed = 0;

const VALID_PUB = "GBJHAYQBTDWZCCWHX6BQDSM5G5VGSWSDK4LRDGSPMICSE2VQQZDYSYHJ";
const VALID_SEC = "SAIYM3LQROZZDSMM64ZXKIWDM6SFZSQLY7OINQ5P6PSK75SEP2J5I2J4";

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log("OK " + name);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as any).code || "None";
      console.log("FAIL " + name + "\n  [Code: " + code + "] " + msg);
      failed++;
    }
  };
  return run();
}

async function runTests() {
  console.log("Running Issuance Tests...\n");

  await test("launchToken mainnet without ALLOW_MAINNET_TOKEN_ISSUANCE throws NETWORK_BLOCKED", async () => {
    const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
    process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = "";
    const agent = new AgentClient({
      network: "mainnet",
      allowMainnet: true,
      publicKey: VALID_PUB,
    });
    try {
      await agent.launchToken({
        issuerSecretKey: VALID_SEC,
        distributorPublicKey: VALID_PUB,
        symbol: "TEST",
        decimals: 7,
        initialSupply: "1000",
      });
      throw new Error("Expected launchToken to throw");
    } catch (e: any) {
      const err = e as AgentKitError;
      if (err.code !== AgentKitErrorCode.NETWORK_BLOCKED) 
        throw new Error("Expected code NETWORK_BLOCKED, got " + err.code);
    } finally {
      process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
    }
  });

  await test("launchToken invalid decimals throws INVALID_DECIMALS", async () => {
    const agent = new AgentClient({
      network: "testnet",
      publicKey: VALID_PUB,
    });
    try {
      await agent.launchToken({
        issuerSecretKey: VALID_SEC,
        distributorPublicKey: VALID_PUB,
        symbol: "X",
        decimals: 10,
        initialSupply: "1",
      });
      throw new Error("Expected launchToken to throw");
    } catch (e: any) {
      const err = e as AgentKitError;
      if (err.code !== AgentKitErrorCode.INVALID_DECIMALS) 
        throw new Error("Expected code INVALID_DECIMALS, got " + err.code);
    }
  });

  console.log("\nIssuance tests: " + passed + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
}

runTests();
