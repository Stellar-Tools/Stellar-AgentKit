import { Route, ExecutionStrategy } from "./types";
import { withRetry } from "./retry";

export class DynamicRouter {
    /**
     * Executes a single route (series of steps) with retry logic per step.
     */
    static async executeRoute(route: Route, strategy: ExecutionStrategy): Promise<any[]> {
        const results = [];
        console.log(`[Antigravity] Starting route execution: ${route.id}`);

        for (const step of route.steps) {
            console.log(`[Antigravity] Executing step: ${step.id} (${step.action})`);

            try {
                const result = await withRetry(
                    step.execute,
                    strategy.maxRetries || 3,
                    strategy.baseDelayMs || 1000,
                    strategy.maxDelayMs || 10000
                );
                results.push(result);
                console.log(`[Antigravity] Step ${step.id} completed successfully.`);
            } catch (err) {
                console.error(`[Antigravity] Step ${step.id} failed in route ${route.id}.`);
                throw err;
            }
        }

        return results;
    }

    /**
     * Executes a primary route, automatically falling back to alternatives if a step fails.
     */
    static async executeWithFallback(
        primaryRoute: Route,
        strategy: ExecutionStrategy
    ): Promise<{ routeId: string, results: any[] }> {
        try {
            const results = await this.executeRoute(primaryRoute, strategy);
            return { routeId: primaryRoute.id, results };
        } catch (error: any) {
            console.warn(`[Antigravity] Primary route ${primaryRoute.id} failed. Attempting fallbacks...`);

            const fallbackRoutes = strategy.fallbackRoutes || [];
            if (fallbackRoutes.length === 0) {
                console.error(`[Antigravity] No fallback routes defined. Execution completely failed.`);
                throw error;
            }

            for (const fallbackRoute of fallbackRoutes) {
                try {
                    console.log(`[Antigravity] Attempting fallback route: ${fallbackRoute.id}`);
                    const results = await this.executeRoute(fallbackRoute, strategy);
                    return { routeId: fallbackRoute.id, results };
                } catch (fallbackErr) {
                    console.error(`[Antigravity] Fallback route ${fallbackRoute.id} also failed.`);
                    // continue to next fallback
                }
            }

            throw new Error(`All routes (primary + ${fallbackRoutes.length} fallbacks) failed.`);
        }
    }
}
