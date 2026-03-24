import { AgentClient } from "../../agent";
import { TransactionStep, Route, ExecutionStrategy } from "./types";
import { DynamicRouter } from "./router";

export class AntigravityEngine {
    private agent: AgentClient;

    constructor(agent: AgentClient) {
        this.agent = agent;
    }

    /**
     * Executes a "floating" transaction composed of multiple dynamic routes.
     * Starts with the primary route, automatically falls back to alternates if needed.
     */
    async execute(
        primaryRoute: Route,
        strategy: ExecutionStrategy = { maxRetries: 3 }
    ): Promise<{ routeId: string, results: any[] }> {
        console.log(`[Antigravity] Initiating Floating Execution for main route: ${primaryRoute.id}`);
        return await DynamicRouter.executeWithFallback(primaryRoute, strategy);
    }

    /**
     * Utility to natively wrap AgentKit swap method as a TransactionStep
     */
    createSwapStep(id: string, params: { to: string, buyA: boolean, out: string, inMax: string }): TransactionStep {
        return {
            id,
            action: "swap",
            params,
            execute: async () => await this.agent.swap(params)
        };
    }

    /**
     * Utility to natively wrap AgentKit lp deposit method as a TransactionStep
     */
    createLpDepositStep(id: string, params: { to: string, desiredA: string, minA: string, desiredB: string, minB: string }): TransactionStep {
        return {
            id,
            action: "deposit",
            params,
            execute: async () => await this.agent.lp.deposit(params)
        };
    }

    /**
     * Utility to wrap bridging as a step
     */
    createBridgeStep(id: string, params: { amount: string, toAddress: string }): TransactionStep {
        return {
            id,
            action: "bridge",
            params,
            execute: async () => await this.agent.bridge(params)
        };
    }
}
