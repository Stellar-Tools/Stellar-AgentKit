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
exports.DynamicRouter = void 0;
const retry_1 = require("./retry");
class DynamicRouter {
    /**
     * Executes a single route (series of steps) with retry logic per step.
     */
    static executeRoute(route, strategy) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            console.log(`[Antigravity] Starting route execution: ${route.id}`);
            for (const step of route.steps) {
                console.log(`[Antigravity] Executing step: ${step.id} (${step.action})`);
                try {
                    const result = yield (0, retry_1.withRetry)(step.execute, strategy.maxRetries || 3, strategy.baseDelayMs || 1000, strategy.maxDelayMs || 10000);
                    results.push(result);
                    console.log(`[Antigravity] Step ${step.id} completed successfully.`);
                }
                catch (err) {
                    console.error(`[Antigravity] Step ${step.id} failed in route ${route.id}.`);
                    throw err;
                }
            }
            return results;
        });
    }
    /**
     * Executes a primary route, automatically falling back to alternatives if a step fails.
     */
    static executeWithFallback(primaryRoute, strategy) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const results = yield this.executeRoute(primaryRoute, strategy);
                return { routeId: primaryRoute.id, results };
            }
            catch (error) {
                console.warn(`[Antigravity] Primary route ${primaryRoute.id} failed. Attempting fallbacks...`);
                const fallbackRoutes = strategy.fallbackRoutes || [];
                if (fallbackRoutes.length === 0) {
                    console.error(`[Antigravity] No fallback routes defined. Execution completely failed.`);
                    throw error;
                }
                for (const fallbackRoute of fallbackRoutes) {
                    try {
                        console.log(`[Antigravity] Attempting fallback route: ${fallbackRoute.id}`);
                        const results = yield this.executeRoute(fallbackRoute, strategy);
                        return { routeId: fallbackRoute.id, results };
                    }
                    catch (fallbackErr) {
                        console.error(`[Antigravity] Fallback route ${fallbackRoute.id} also failed.`);
                        // continue to next fallback
                    }
                }
                throw new Error(`All routes (primary + ${fallbackRoutes.length} fallbacks) failed.`);
            }
        });
    }
}
exports.DynamicRouter = DynamicRouter;
