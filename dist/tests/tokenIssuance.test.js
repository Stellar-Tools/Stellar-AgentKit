"use strict";
/**
 * Token issuance tests: validation, mainnet safeguard, and AgentKitError.
 * Uses lib/tokenIssuance (symbol, initialSupply, enum AgentKitErrorCode).
 */
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
const tokenIssuance_1 = require("../lib/tokenIssuance");
const errors_1 = require("../lib/errors");
const agent_1 = require("../agent");
let passed = 0;
let failed = 0;
function test(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const p = fn();
            if (p && typeof p.then === "function") {
                yield p;
            }
            console.log(`✅ ${name}`);
            passed++;
        }
        catch (e) {
            console.log(`❌ ${name}\n   → ${e instanceof Error ? e.message : String(e)}`);
            failed++;
        }
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
                throw new Error(`Expected defined, got ${actual}`);
        },
    };
}
const fakeIssuerPub = "G" + "A".repeat(55);
const fakeDistributorPub = "G" + "B".repeat(55);
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield test("launchToken with invalid asset code throws VALIDATION", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                symbol: "",
                initialSupply: "1000",
                issuerSecretKey: "S" + "A".repeat(55),
                distributorPublicKey: fakeDistributorPub,
                distributorSecretKey: "S" + "B".repeat(55),
                network: "testnet",
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            expect((0, errors_1.isAgentKitError)(e)).toBe(true);
            expect(e.code).toBe(errors_1.AgentKitErrorCode.VALIDATION);
        }
    }));
    yield test("launchToken with invalid address throws INVALID_ADDRESS", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                symbol: "TEST",
                initialSupply: "1000",
                issuerSecretKey: "S" + "A".repeat(55),
                distributorPublicKey: "not-an-address",
                distributorSecretKey: "S" + "B".repeat(55),
                network: "testnet",
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            expect((0, errors_1.isAgentKitError)(e)).toBe(true);
            expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
        }
    }));
    yield test("launchToken with invalid supply throws INVALID_SUPPLY", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                symbol: "TEST",
                issuerSecretKey: "S" + "A".repeat(55),
                distributorPublicKey: fakeDistributorPub,
                distributorSecretKey: "S" + "B".repeat(55),
                network: "testnet",
                initialSupply: "0",
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            expect((0, errors_1.isAgentKitError)(e)).toBe(true);
            expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_SUPPLY);
        }
    }));
    yield test("launchToken on mainnet without ALLOW_MAINNET_TOKEN_ISSUANCE throws NETWORK_BLOCKED", () => __awaiter(void 0, void 0, void 0, function* () {
        const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        try {
            yield (0, tokenIssuance_1.launchToken)({
                symbol: "TEST",
                initialSupply: "1000",
                issuerSecretKey: "S" + "A".repeat(55),
                distributorPublicKey: fakeDistributorPub,
                distributorSecretKey: "S" + "B".repeat(55),
                network: "mainnet",
                allowMainnetTokenIssuance: false,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            expect((0, errors_1.isAgentKitError)(e)).toBe(true);
            expect(e.code).toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
        }
        finally {
            if (prev !== undefined)
                process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
        }
    }));
    yield test("AgentClient.launchToken exists and accepts params", () => {
        const client = new agent_1.AgentClient({
            network: "testnet",
            publicKey: fakeIssuerPub,
        });
        expect(typeof client.launchToken).toBe("function");
        expect(client.launchToken).toBeDefined();
    });
    console.log("\n--- Token issuance test summary ---");
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        throw new Error(`${failed} test(s) failed`);
}))();
