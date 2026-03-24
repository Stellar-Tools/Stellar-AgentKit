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
exports.AntigravityEngine = void 0;
const router_1 = require("./router");
class AntigravityEngine {
    constructor(agent) {
        this.agent = agent;
    }
    /**
     * Executes a "floating" transaction composed of multiple dynamic routes.
     * Starts with the primary route, automatically falls back to alternates if needed.
     */
    execute(primaryRoute_1) {
        return __awaiter(this, arguments, void 0, function* (primaryRoute, strategy = { maxRetries: 3 }) {
            console.log(`[Antigravity] Initiating Floating Execution for main route: ${primaryRoute.id}`);
            return yield router_1.DynamicRouter.executeWithFallback(primaryRoute, strategy);
        });
    }
    /**
     * Utility to natively wrap AgentKit swap method as a TransactionStep
     */
    createSwapStep(id, params) {
        return {
            id,
            action: "swap",
            params,
            execute: () => __awaiter(this, void 0, void 0, function* () { return yield this.agent.swap(params); })
        };
    }
    /**
     * Utility to natively wrap AgentKit lp deposit method as a TransactionStep
     */
    createLpDepositStep(id, params) {
        return {
            id,
            action: "deposit",
            params,
            execute: () => __awaiter(this, void 0, void 0, function* () { return yield this.agent.lp.deposit(params); })
        };
    }
    /**
     * Utility to wrap bridging as a step
     */
    createBridgeStep(id, params) {
        return {
            id,
            action: "bridge",
            params,
            execute: () => __awaiter(this, void 0, void 0, function* () { return yield this.agent.bridge(params); })
        };
    }
}
exports.AntigravityEngine = AntigravityEngine;
