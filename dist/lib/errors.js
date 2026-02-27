"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifySimulationMessage = exports.AgentKitError = exports.AgentKitErrorCode = void 0;
exports.isAgentKitError = isAgentKitError;
exports.classifySimulationError = classifySimulationError;
/**
 * AgentKit error types and helpers.
 */
exports.AgentKitErrorCode = {
    INVALID_ADDRESS: "INVALID_ADDRESS",
    INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
    MISSING_TRUSTLINE: "MISSING_TRUSTLINE",
    SLIPPAGE_TOO_HIGH: "SLIPPAGE_TOO_HIGH",
    SIMULATION_FAILED: "SIMULATION_FAILED",
    VALIDATION: "VALIDATION",
    NETWORK_BLOCKED: "NETWORK_BLOCKED",
    TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
    INVALID_DECIMALS: "INVALID_DECIMALS",
    INVALID_SUPPLY: "INVALID_SUPPLY",
    TRUSTLINE_FAILED: "TRUSTLINE_FAILED",
    MINT_FAILED: "MINT_FAILED",
};
class AgentKitError extends Error {
    constructor(code, message, context, cause) {
        super(message);
        this.code = code;
        this.context = context;
        this.cause = cause;
        this.name = "AgentKitError";
    }
}
exports.AgentKitError = AgentKitError;
function isAgentKitError(e) {
    return e instanceof AgentKitError;
}
/**
 * Map simulation error messages to error codes.
 */
function classifySimulationError(message) {
    const lower = message.toLowerCase();
    if (lower.includes("insufficient balance"))
        return exports.AgentKitErrorCode.INSUFFICIENT_BALANCE;
    if (lower.includes("trustline") && (lower.includes("required") || lower.includes("missing")))
        return exports.AgentKitErrorCode.MISSING_TRUSTLINE;
    if (lower.includes("slippage"))
        return exports.AgentKitErrorCode.SLIPPAGE_TOO_HIGH;
    return exports.AgentKitErrorCode.SIMULATION_FAILED;
}
exports.classifySimulationMessage = classifySimulationError;
