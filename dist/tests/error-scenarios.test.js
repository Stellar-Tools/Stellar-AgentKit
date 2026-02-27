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
 * Error scenario tests: mainnet guard, invalid address.
 */
const agent_1 = require("../agent");
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
            console.log(`❌ ${name}\n   → ${msg}`);
            failed++;
        }
    });
    return run();
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield test("AgentClient mainnet without allowMainnet throws", () => __awaiter(this, void 0, void 0, function* () {
            try {
                new agent_1.AgentClient({
                    network: "mainnet",
                    publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                });
                throw new Error("Expected constructor to throw");
            }
            catch (e) {
                if (!(e instanceof Error))
                    throw e;
                if (!e.message.includes("Mainnet") && !e.message.includes("allowMainnet"))
                    throw new Error(`Expected mainnet safety message, got: ${e.message}`);
            }
        }));
        yield test("swap with invalid 'to' address throws", () => __awaiter(this, void 0, void 0, function* () {
            const agent = new agent_1.AgentClient({
                network: "testnet",
                publicKey: process.env.STELLAR_PUBLIC_KEY || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
            try {
                yield agent.swap({
                    to: "invalid-address",
                    buyA: true,
                    out: "1",
                    inMax: "1",
                });
                throw new Error("Expected swap to throw");
            }
            catch (e) {
                if (!(e instanceof Error))
                    throw e;
                if (!e.message.includes("Invalid") && !e.message.includes("address"))
                    throw new Error(`Expected invalid address error, got: ${e.message}`);
            }
        }));
        yield test("AgentClient testnet with allowMainnet does not throw", () => {
            new agent_1.AgentClient({
                network: "testnet",
                allowMainnet: true,
                publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            });
        });
        console.log(`\nError scenarios: ${passed} passed, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    });
}
run();
