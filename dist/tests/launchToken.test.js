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
const launchToken_1 = require("../lib/launchToken");
const errors_1 = require("../lib/errors");
const validIssuerSecret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE2R";
const validDistributorPubkey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHF";
function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`Expected ${expected}, got ${actual}`);
        },
    };
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Mainnet without opt-in -> NETWORK_BLOCKED
        const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        try {
            yield (0, launchToken_1.launchToken)({
                network: "mainnet",
                allowMainnetTokenIssuance: false,
                symbol: "TEST",
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e))
                expect(e.code).toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
            else
                throw e;
        }
        finally {
            if (prev !== undefined)
                process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
        }
        // Mainnet with allowMainnet but no env -> NETWORK_BLOCKED
        delete process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
        try {
            yield (0, launchToken_1.launchToken)({
                network: "mainnet",
                allowMainnetTokenIssuance: true,
                symbol: "TEST",
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e))
                expect(e.code).toBe(errors_1.AgentKitErrorCode.NETWORK_BLOCKED);
            else
                throw e;
        }
        finally {
            if (prev !== undefined)
                process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
        }
        // Invalid decimals -> INVALID_DECIMALS (not VALIDATION in our tokenIssuance)
        try {
            yield (0, launchToken_1.launchToken)({
                network: "testnet",
                symbol: "TEST",
                decimals: 10,
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e))
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_DECIMALS);
            else
                throw e;
        }
        // Zero supply -> INVALID_SUPPLY
        try {
            yield (0, launchToken_1.launchToken)({
                network: "testnet",
                symbol: "TEST",
                initialSupply: "0",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e))
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_SUPPLY);
            else
                throw e;
        }
        // Invalid symbol -> INVALID_ADDRESS
        try {
            yield (0, launchToken_1.launchToken)({
                network: "testnet",
                symbol: "INVALID_SYMBOL_TOO_LONG_XXX",
                initialSupply: "100",
                issuerSecretKey: validIssuerSecret,
                distributorPublicKey: validDistributorPubkey,
            });
            throw new Error("Expected throw");
        }
        catch (e) {
            if ((0, errors_1.isAgentKitError)(e))
                expect(e.code).toBe(errors_1.AgentKitErrorCode.INVALID_ADDRESS);
            else
                throw e;
        }
        // AgentKitError 4-arg constructor
        const err = new errors_1.AgentKitError(errors_1.AgentKitErrorCode.VALIDATION, "test", { symbol: "X" }, new Error("cause"));
        expect(err.code).toBe(errors_1.AgentKitErrorCode.VALIDATION);
        console.log("✅ launchToken.test.ts passed");
    });
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
