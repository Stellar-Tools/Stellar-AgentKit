"use strict";
/**
 * Token issuance tests: mainnet safeguard, validation (decimals, supply), and error codes.
 * Does not require live testnet (validation and mainnet guard only).
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
let passed = 0;
let failed = 0;
function test(name, fn) {
    const run = () => {
        const result = fn();
        return result instanceof Promise ? result : Promise.resolve();
    };
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
const validIssuerSecret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE2R";
const validDistributorPubkey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";
Promise.all([
    test("launchToken on mainnet without allowMainnetTokenIssuance throws NETWORK_BLOCKED", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        try {
            yield (0, tokenIssuance_1.launchToken)({
                network: "mainnet",
                allowMainnetTokenIssuance: false,
                symbol: "TEST",
                initialSupply: "100.0000000",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
                expect((_a = e.context) === null || _a === void 0 ? void 0 : _a.network).toBe("mainnet");
            }
            else
                throw e;
        }
        finally {
            if (prev !== undefined)
                process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
        }
    })),
    test("launchToken with invalid decimals throws INVALID_DECIMALS", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            yield (0, tokenIssuance_1.launchToken)({
                network: "testnet",
                symbol: "TEST",
                decimals: 10,
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_DECIMALS);
                expect((_a = e.context) === null || _a === void 0 ? void 0 : _a.decimals).toBe(10);
            }
            else
                throw e;
        }
    })),
    test("launchToken with zero initialSupply throws INVALID_SUPPLY", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                network: "testnet",
                symbol: "TEST",
                initialSupply: "0",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_SUPPLY);
            }
            else
                throw e;
        }
    })),
    test("launchToken with negative supply throws INVALID_SUPPLY", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                network: "testnet",
                symbol: "TEST",
                initialSupply: "-100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_SUPPLY);
            }
            else
                throw e;
        }
    })),
    test("launchToken with invalid symbol (too long) throws", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, tokenIssuance_1.launchToken)({
                network: "testnet",
                symbol: "INVALID_SYMBOL_TOO_LONG",
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected launchToken to throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e)) {
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
            }
            else
                throw e;
        }
    })),
]).then(() => {
    console.log(`\nToken issuance tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
