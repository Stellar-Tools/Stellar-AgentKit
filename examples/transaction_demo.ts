import { AgentClient } from "../index";
import { Route, ExecutionStrategy, ErrorType, AntigravityError } from "../lib/transaction system/types";

// Configuration for AgentKit
const agent = new AgentClient({
    network: "testnet",
    publicKey: "GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" // Example pub key
});

async function main() {
    console.log("🚀 Starting Antigravity Transaction System Demo");

    // Define a step that simulates a network failure (TRANSIENT)
    const flakeyStep = {
        id: "flakey-network-call",
        action: "custom" as const,
        execute: async () => {
            if (Math.random() > 0.2) {
                throw new Error("Temporary network timeout");
            }
            return "Success on flakey step!";
        }
    };

    // Define a step that simulates a definite failure (PERMANENT)
    const failingSwapStep = {
        id: "failing-swap",
        action: "swap" as const,
        execute: async () => {
            throw new Error("Insufficient funds for swap");
        }
    };

    // Define a fallback successful step
    const safeDepositStep = agent.antigravity.createLpDepositStep("safe-deposit", {
        to: "CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        desiredA: "100",
        minA: "99",
        desiredB: "100",
        minB: "99"
    });

    // Mocking the actual execution of the safe deposit for the sake of the demo
    safeDepositStep.execute = async () => {
        return "Safe deposit succeeded!";
    };

    // Define the primary route which is doomed to fail permanently
    const primaryRoute: Route = {
        id: "route-primary-swap",
        steps: [flakeyStep, failingSwapStep]
    };

    // Define the fallback route which will succeed
    const fallbackRoute: Route = {
        id: "route-fallback-deposit",
        steps: [safeDepositStep]
    };

    // Define the Antigravity Execution Strategy
    const strategy: ExecutionStrategy = {
        maxRetries: 3,
        baseDelayMs: 500,  // Fast retries for demo
        maxDelayMs: 2000,
        fallbackRoutes: [fallbackRoute]
    };

    try {
        console.log("\n--- EXECUTING ANTIGRAVITY ENGINE ---");
        const result = await agent.antigravity.execute(primaryRoute, strategy);

        console.log("\n✅ Floating Execution Completed Successfully via Route:", result.routeId);
        console.log("Final Results:", result.results);
    } catch (error) {
        console.error("\n❌ Floating Execution Failed Completely:", error);
    }
}

main().catch(console.error);
