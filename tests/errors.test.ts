/**
 * Error handling tests: AgentKitError, AgentKitErrorCode (value import), classifySimulationMessage.
 */
import {
  AgentKitError,
  AgentKitErrorCode,
  classifySimulationMessage,
  isAgentKitError,
} from "../lib/errors";

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
    },
  };
}

// AgentKitErrorCode is used as value (enum)
const codeInvalid = AgentKitErrorCode.INVALID_ADDRESS;
expect(codeInvalid).toBe("INVALID_ADDRESS");

// classifySimulationMessage is alias for classifySimulationError
const code = classifySimulationMessage("insufficient balance");
expect(code).toBe(AgentKitErrorCode.INSUFFICIENT_BALANCE);
expect(classifySimulationMessage("trustline required")).toBe(AgentKitErrorCode.MISSING_TRUSTLINE);
expect(classifySimulationMessage("slippage exceeded")).toBe(AgentKitErrorCode.SLIPPAGE_TOO_HIGH);
expect(classifySimulationMessage("invalid address")).toBe(AgentKitErrorCode.SIMULATION_FAILED);
expect(classifySimulationMessage("unknown error")).toBe(AgentKitErrorCode.SIMULATION_FAILED);

// AgentKitError constructor: (code, message, context?, cause?)
const err = new AgentKitError(
  AgentKitErrorCode.VALIDATION,
  "test message",
  { foo: "bar" },
  new Error("cause")
);
expect(isAgentKitError(err)).toBe(true);
expect(err.code).toBe(AgentKitErrorCode.VALIDATION);
expect(err.message).toBe("test message");
expect(err.context?.foo).toBe("bar");

console.log("✅ errors.test.ts passed");
