import { AgentClient } from "../index";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Phase 6: Multi-Agent Orchestration Example
 * 
 * In a professional AI setup, tasks are split between specialized agents.
 * 1. Analyst Agent: Monitors the market and makes strategic decisions.
 * 2. Executor Agent: Interacts with the Stellar network using the SDK.
 */

// --- Mock Analyst Agent ---
class AnalystAgent {
  async analyzeMarket() {
    console.log("[Analyst] Analyzing Stellar DEX liquidity and yield opportunities...");
    // Artificial intelligence logic would go here
    // For this example, we'll simulate a decision to bridge USDC to Ethereum for better yield
    return {
      action: "BRIDGE",
      asset: "USDC",
      amount: "50",
      destination: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Mock ETH Address
      reason: "Yield on Aave (Ethereum) is currently 2% higher than Stellar liquidity pools."
    };
  }
}

// --- Executor Agent (Powered by Stellar AgentKit) ---
class ExecutorAgent {
  private client: AgentClient;

  constructor(client: AgentClient) {
    this.client = client;
  }

  async execute(instruction: any) {
    console.log(`[Executor] Received instruction: ${instruction.action} ${instruction.amount} ${instruction.asset}`);
    console.log(`[Executor] Reason: ${instruction.reason}`);

    if (instruction.action === "BRIDGE") {
      console.log("[Executor] Checking balances before bridging...");
      const balances = JSON.parse(await this.client.getBalances());
      const usdc = balances.balances.find((b: any) => b.code === "USDC");

      if (usdc && parseFloat(usdc.balance) >= parseFloat(instruction.amount)) {
        console.log("[Executor] Balance sufficient. Initiating bridge via Allbridge...");
        const result = await this.client.bridge({
          amount: instruction.amount,
          toAddress: instruction.destination,
          assetSymbol: instruction.asset
        });
        console.log(`[Executor] Bridge Success! Hash: ${result.hash}`);
      } else {
        console.log("[Executor] Error: Insufficient USDC balance for bridging.");
      }
    }
  }
}

// --- Orchestration Logic ---
async function main() {
  console.log("=== Stellar AgentKit: Multi-Agent Orchestration ===\n");

  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY,
  });

  const analyst = new AnalystAgent();
  const executor = new ExecutorAgent(agent);

  // 1. Analyst makes a decision
  const strategicDecision = await analyst.analyzeMarket();
  
  // 2. Executor carries out the task autonomously
  await executor.execute(strategicDecision);

  console.log("\n=== Orchestration Flow Complete ===");
}

main().catch(console.error);
