"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
/**
 * AgentKitError integration: swap invalid address, LP tool missing params, bridge mainnet guard.
 */
const agent_1 = require("../agent");
const errors_1 = require("../lib/errors");
const contractTool = __importStar(require("../tools/contract"));
let passed = 0;
let failed = 0;
function test(name, fn) {
    const run = () => __awaiter(this, void 0, void 0, function* () {
        try {
            yield fn();
            console.log(`✅ ${name}`);
            passed++;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const nameAttr = e.name || "Unknown";
            console.log(`❌ ${name}\n   → [${nameAttr}] ${msg}`);
            if (e instanceof Error && e.stack && !msg.includes("Expected")) {
                console.log(e.stack);
            }
            failed++;
        }
    });
    return run();
}
function expect(actual, label) {
    return {
        toBeDefined: () => {
            if (actual === undefined || actual === null)
                throw new Error(`${label || 'Value'} expected to be defined, got ${actual}`);
        },
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`${label || 'Value'} expected ${expected}, got ${actual}`);
        },
        toContain: (sub) => {
            if (typeof actual !== "string" || !actual.includes(sub))
                throw new Error(`${label || 'String'} expected to contain "${sub}", got ${actual}`);
        },
    };
}
function runTests() {
    return __awaiter(this, void 0, void 0, function* () {
        yield test("swap with invalid address throws AgentKitError with code INVALID_ADDRESS and context", () => __awaiter(this, void 0, void 0, function* () {
            const agent = new agent_1.AgentClient({
                network: "testnet",
                publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
            try {
                yield agent.swap({
                    to: "invalid-address",
                    buyA: true,
                    out: "100",
                    inMax: "110",
                });
                throw new Error("Expected swap to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
                expect(err.context, "Error context").toBeDefined();
                expect(err.message.toLowerCase(), "Error message").toContain("address format");
            }
        }));
        yield test("swap with invalid address includes to in context", () => __awaiter(this, void 0, void 0, function* () {
            const agent = new agent_1.AgentClient({
                network: "testnet",
                publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
            try {
                yield agent.swap({ to: "bad", buyA: false, out: "1", inMax: "2" });
                throw new Error("Expected swap to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
                expect(err.context, "Error context").toBeDefined();
                expect(err.context.to, "Context 'to'").toBe("bad");
            }
        }));
        yield test("LP tool swap with missing inMax throws AgentKitError TOOL_EXECUTION_FAILED", () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield contractTool.StellarLiquidityContractTool.invoke({
                    action: "swap",
                    to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    buyA: true,
                    out: "100",
                });
                throw new Error("Expected tool to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED);
            }
        }));
        yield test("LP tool deposit with missing params throws AgentKitError TOOL_EXECUTION_FAILED", () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield contractTool.StellarLiquidityContractTool.invoke({
                    action: "deposit",
                    to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    desiredA: "10",
                    minA: "9",
                    desiredB: "10",
                });
                throw new Error("Expected tool to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED);
            }
        }));
        yield test("stake.getStake with invalid address throws AgentKitError INVALID_ADDRESS", () => __awaiter(this, void 0, void 0, function* () {
            const agent = new agent_1.AgentClient({
                network: "testnet",
                publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
            try {
                yield agent.stake.getStake("bad");
                throw new Error("Expected stake.getStake to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
                expect(err.context, "Error context").toBeDefined();
                expect(err.context.to, "Context 'to'").toBe("bad");
            }
        }));
        yield test("LP tool deposit with missing minA throws AgentKitError TOOL_EXECUTION_FAILED", () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield contractTool.StellarLiquidityContractTool.invoke({
                    action: "deposit",
                    to: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    desiredA: "10",
                    desiredB: "10",
                    minB: "9",
                });
                throw new Error("Expected tool to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED);
            }
        }));
        yield test("bridge on mainnet without ALLOW_MAINNET_BRIDGE throws AgentKitError NETWORK_BLOCKED", () => __awaiter(this, void 0, void 0, function* () {
            const prev = process.env.ALLOW_MAINNET_BRIDGE;
            process.env.ALLOW_MAINNET_BRIDGE = "";
            const agent = new agent_1.AgentClient({
                network: "mainnet",
                allowMainnet: true,
                publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
            try {
                yield agent.bridge({ amount: "10", toAddress: "0x123" });
                throw new Error("Expected bridge to throw");
            }
            catch (e) {
                const err = e;
                expect(err.name === "AgentKitError", "Error name").toBe(true);
                expect(err.code, "Error code").toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
                expect(err.context, "Error context").toBeDefined();
                expect(err.context.network, "Context network").toBe("stellar-mainnet");
                expect(err.context.amount, "Context amount").toBe("10");
            }
            finally {
                process.env.ALLOW_MAINNET_BRIDGE = prev;
            }
        }));
        console.log(`\nAgentKitError tests: ${passed} passed, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    });
}
runTests();
