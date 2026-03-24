"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
// Configuration for AgentKit
const agent = new index_1.AgentClient({
    network: "testnet",
    publicKey: "GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" // Example pub key
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Starting Antigravity Transaction System Demo");
        // Define a step that simulates a network failure (TRANSIENT)
        const flakeyStep = {
            id: "flakey-network-call",
            action: "custom",
            execute: () => __awaiter(this, void 0, void 0, function* () {
                if (Math.random() > 0.2) {
                    throw new Error("Temporary network timeout");
                }
                return "Success on flakey step!";
            })
        };
        // Define a step that simulates a definite failure (PERMANENT)
        const failingSwapStep = {
            id: "failing-swap",
            action: "swap",
            execute: () => __awaiter(this, void 0, void 0, function* () {
                throw new Error("Insufficient funds for swap");
            })
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
        safeDepositStep.execute = () => __awaiter(this, void 0, void 0, function* () {
            return "Safe deposit succeeded!";
        });
        // Define the primary route which is doomed to fail permanently
        const primaryRoute = {
            id: "route-primary-swap",
            steps: [flakeyStep, failingSwapStep]
        };
        // Define the fallback route which will succeed
        const fallbackRoute = {
            id: "route-fallback-deposit",
            steps: [safeDepositStep]
        };
        // Define the Antigravity Execution Strategy
        const strategy = {
            maxRetries: 3,
            baseDelayMs: 500, // Fast retries for demo
            maxDelayMs: 2000,
            fallbackRoutes: [fallbackRoute]
        };
        try {
            console.log("\n--- EXECUTING ANTIGRAVITY ENGINE ---");
            const result = yield agent.antigravity.execute(primaryRoute, strategy);
            console.log("\n✅ Floating Execution Completed Successfully via Route:", result.routeId);
            console.log("Final Results:", result.results);
        }
        catch (error) {
            console.error("\n❌ Floating Execution Failed Completely:", error);
        }
    });
}
main().catch(console.error);
