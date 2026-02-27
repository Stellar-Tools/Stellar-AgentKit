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
/**
 * Contract and bridge error tests: invalid address (swap), mainnet bridge guard.
 */
const contract_1 = require("../lib/contract");
const errors_1 = require("../lib/errors");
const bridge_1 = require("../tools/bridge");
let passed = 0;
let failed = 0;
function test(name, fn) {
    const run = () => { var _a; return (typeof ((_a = fn()) === null || _a === void 0 ? void 0 : _a.then) === "function" ? fn() : Promise.resolve()); };
    return run()
        .then(() => {
        console.log(`✅ ${name}`);
        passed++;
    })
        .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`❌ ${name}\n   → ${msg}`);
        failed++;
    });
}
function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`Expected ${expected}, got ${actual}`);
        },
        toBeDefined: () => {
            if (actual === undefined || actual === null)
                throw new Error(`Expected value to be defined, got ${actual}`);
        },
    };
}
const validCaller = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";
Promise.all([
    test("swap with invalid address throws AgentKitError with INVALID_ADDRESS and context.to", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, contract_1.swap)(validCaller, "invalid_address", true, "100", "200");
            throw new Error("Expected swap to throw");
        }
        catch (e) {
            expect((0, errors_1.isAgentKitError)(e)).toBe(true);
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
                expect(e.context).toBeDefined();
                expect(e.context.to).toBe("invalid_address");
            }
        }
    })),
    test("swap with too-short address throws AgentKitError with INVALID_ADDRESS", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, contract_1.swap)(validCaller, "G123", false, "1", "2");
            throw new Error("Expected swap to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
                expect(e.context.to).toBe("G123");
            }
            else {
                throw e;
            }
        }
    })),
    test("bridge with stellar-mainnet without ALLOW_MAINNET_BRIDGE throws NETWORK_BLOCKED with context", () => __awaiter(void 0, void 0, void 0, function* () {
        const prev = process.env.ALLOW_MAINNET_BRIDGE;
        delete process.env.ALLOW_MAINNET_BRIDGE;
        try {
            const func = bridge_1.bridgeTokenTool.func;
            yield func({
                amount: "1",
                toAddress: "0x0000000000000000000000000000000000000001",
                fromNetwork: "stellar-mainnet",
            });
            throw new Error("Expected bridge to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
                expect(e.context.network).toBe("stellar-mainnet");
                expect(e.context.amount).toBe("1");
            }
            else {
                throw e;
            }
        }
        finally {
            if (prev !== undefined)
                process.env.ALLOW_MAINNET_BRIDGE = prev;
        }
    })),
]).then(() => {
    console.log(`\nContract errors tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
