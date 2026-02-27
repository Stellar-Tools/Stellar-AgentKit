"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Error handling tests: AgentKitError, AgentKitErrorCode (value import), classifySimulationMessage.
 */
const errors_1 = require("../lib/errors");
function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`Expected ${expected}, got ${actual}`);
        },
    };
}
// AgentKitErrorCode is used as value (enum)
const codeInvalid = errors_1.AgentKitErrorCode.INVALID_ADDRESS;
expect(codeInvalid).toBe("INVALID_ADDRESS");
// classifySimulationMessage is alias for classifySimulationError
const code = (0, errors_1.classifySimulationMessage)("insufficient balance");
expect(code).toBe(errors_1.AgentKitErrorCode.INSUFFICIENT_BALANCE);
expect((0, errors_1.classifySimulationMessage)("trustline required")).toBe(errors_1.AgentKitErrorCode.MISSING_TRUSTLINE);
expect((0, errors_1.classifySimulationMessage)("slippage exceeded")).toBe(errors_1.AgentKitErrorCode.SLIPPAGE_TOO_HIGH);
expect((0, errors_1.classifySimulationMessage)("invalid address")).toBe(errors_1.AgentKitErrorCode.SIMULATION_FAILED);
expect((0, errors_1.classifySimulationMessage)("unknown error")).toBe(errors_1.AgentKitErrorCode.SIMULATION_FAILED);
// AgentKitError constructor: (code, message, context?, cause?)
const err = new errors_1.AgentKitError(errors_1.AgentKitErrorCode.VALIDATION, "test message", { foo: "bar" }, new Error("cause"));
expect((0, errors_1.isAgentKitError)(err)).toBe(true);
expect(err.code).toBe(errors_1.AgentKitErrorCode.VALIDATION);
expect(err.message).toBe("test message");
expect((_a = err.context) === null || _a === void 0 ? void 0 : _a.foo).toBe("bar");
console.log("✅ errors.test.ts passed");
