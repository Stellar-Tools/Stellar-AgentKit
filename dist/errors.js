"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentKitError = void 0;
exports.ensureAgentKitError = ensureAgentKitError;
exports.isAgentKitError = isAgentKitError;
/**
 * Structured error type for Stellar AgentKit.
 * Public methods (swap, bridge, lp.*) throw this (or subclasses) with a stable `code` and optional `context`.
 *
 * @example
 * try {
 *   await agent.swap({ to: "G...", buyA: true, out: "100", inMax: "110" });
 * } catch (err) {
 *   if (err instanceof AgentKitError) {
 *     if (err.code === "invalid_address") console.log("Bad address:", err.context?.address);
 *     if (err.code === "slippage_too_high") console.log("Slippage:", err.context);
 *   }
 *   throw err;
 * }
 */
class AgentKitError extends Error {
    constructor(message, code, options) {
        super(message);
        this.name = "AgentKitError";
        this.code = code;
        this.context = options === null || options === void 0 ? void 0 : options.context;
        this.cause = options === null || options === void 0 ? void 0 : options.cause;
        Object.setPrototypeOf(this, AgentKitError.prototype);
    }
}
exports.AgentKitError = AgentKitError;
/**
 * Ensures an unknown thrown value is an AgentKitError; if not, wraps it with code "unknown".
 */
function ensureAgentKitError(error, fallbackContext) {
    if (error instanceof AgentKitError)
        return error;
    const message = error instanceof Error ? error.message : String(error);
    return new AgentKitError(message, "unknown", {
        context: fallbackContext,
        cause: error,
    });
}
/**
 * Type guard to check if an error is an AgentKitError.
 */
function isAgentKitError(error) {
    return error instanceof AgentKitError;
}
