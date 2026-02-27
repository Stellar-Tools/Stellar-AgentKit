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
 * Token issuance tests: mainnet safeguard, invalid params.
 */
const index_1 = require("../index");
const errors_1 = require("../lib/errors");
let passed = 0;
let failed = 0;
const VALID_PUB = "GBJHAYQBTDWZCCWHX6BQDSM5G5VGSWSDK4LRDGSPMICSE2VQQZDYSYHJ";
const VALID_SEC = "SAIYM3LQROZZDSMM64ZXKIWDM6SFZSQLY7OINQ5P6PSK75SEP2J5I2J4";
function test(name, fn) {
    const run = () => __awaiter(this, void 0, void 0, function* () {
        try {
            yield fn();
            console.log("OK " + name);
            passed++;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const code = e.code || "None";
            console.log("FAIL " + name + "\n  [Code: " + code + "] " + msg);
            failed++;
        }
    });
    return run();
}
function runTests() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Running Issuance Tests...\n");
        yield test("launchToken mainnet without ALLOW_MAINNET_TOKEN_ISSUANCE throws NETWORK_BLOCKED", () => __awaiter(this, void 0, void 0, function* () {
            const prev = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE;
            process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = "";
            const agent = new index_1.AgentClient({
                network: "mainnet",
                allowMainnet: true,
                publicKey: VALID_PUB,
            });
            try {
                yield agent.launchToken({
                    issuerSecretKey: VALID_SEC,
                    distributorPublicKey: VALID_PUB,
                    symbol: "TEST",
                    decimals: 7,
                    initialSupply: "1000",
                });
                throw new Error("Expected launchToken to throw");
            }
            catch (e) {
                const err = e;
                if (err.code !== errors_1.AgentKitErrorCode.NETWORK_BLOCKED)
                    throw new Error("Expected code NETWORK_BLOCKED, got " + err.code);
            }
            finally {
                process.env.ALLOW_MAINNET_TOKEN_ISSUANCE = prev;
            }
        }));
        yield test("launchToken invalid decimals throws INVALID_DECIMALS", () => __awaiter(this, void 0, void 0, function* () {
            const agent = new index_1.AgentClient({
                network: "testnet",
                publicKey: VALID_PUB,
            });
            try {
                yield agent.launchToken({
                    issuerSecretKey: VALID_SEC,
                    distributorPublicKey: VALID_PUB,
                    symbol: "X",
                    decimals: 10,
                    initialSupply: "1",
                });
                throw new Error("Expected launchToken to throw");
            }
            catch (e) {
                const err = e;
                if (err.code !== errors_1.AgentKitErrorCode.INVALID_DECIMALS)
                    throw new Error("Expected code INVALID_DECIMALS, got " + err.code);
            }
        }));
        console.log("\nIssuance tests: " + passed + " passed, " + failed + " failed");
        if (failed > 0)
            process.exit(1);
    });
}
runTests();
