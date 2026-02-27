import { AgentClient } from "../index";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Winner Example: Autonomous Portfolio Rebalancer
 * This bot demonstrates:
 * 1. Balance checking
 * 2. Decision making
 * 3. Automatic trustline management
 * 4. Swapping with retry logic
 */
async function main() {
  console.log("🚀 Starting Autonomous Portfolio Rebalancer Bot...");

  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY,
  });

  // Target Portfolio: Keep at least 50 XLM
  const MIN_XLM = 50;
  const USDC_ASSET = {
    code: "USDC",
    issuer: "GBBD67IF65J7OSM6R767G6CHHAF33B9SGYD1I967CH7G66AFGEY4G2O", // Testnet USDC
  };

  try {
    // 1. Check current balance
    console.log("Checking balances...");
    const balanceData = JSON.parse(await agent.getBalances());
    const xlmBalance = parseFloat(balanceData.balances.find((b: any) => b.asset === "XLM")?.balance || "0");

    console.log(`Current XLM Balance: ${xlmBalance}`);

    if (xlmBalance < MIN_XLM) {
      console.log(`⚠️ XLM balance is below ${MIN_XLM}. Attempting to rebalance from USDC...`);

      // 2. Ensure trustline for USDC exists (just in case)
      console.log("Ensuring trustline for USDC...");
      await agent.ensureTrustline({
        assetCode: USDC_ASSET.code,
        assetIssuer: USDC_ASSET.issuer,
      });

      // 3. Check USDC balance
      const usdcBalance = parseFloat(balanceData.balances.find((b: any) => b.code === "USDC")?.balance || "0");
      console.log(`Current USDC Balance: ${usdcBalance}`);

      if (usdcBalance > 0) {
        console.log("Executing swap: USDC -> XLM...");
        // Swap 10 USDC for XLM
        const swapResult = await agent.swap({
          to: balanceData.address,
          buyA: true, // Buy XLM (Asset A is usually native in these pools)
          out: "100", // Desired XLM amount
          inMax: "10", // Max USDC to spend
        });
        console.log(`✅ Rebalance complete! Hash: ${swapResult.hash}`);
      } else {
        console.log("❌ No USDC available to swap. Please deposit funds.");
      }
    } else {
      console.log("✅ XLM balance is healthy. No action needed.");
    }
  } catch (error) {
    console.error("Bot execution failed:", error);
  }
}

main();
