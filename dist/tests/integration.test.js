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
 * Lightweight integration tests: run against testnet when keys are available.
 * Skip in CI when STELLAR_PUBLIC_KEY is unset or the CI dummy (no real RPC needed).
 */
const agent_1 = require("../agent");
const CI_DUMMY_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
function shouldRunIntegration() {
    const key = process.env.STELLAR_PUBLIC_KEY;
    const explicit = process.env.RUN_INTEGRATION_TESTS === "1";
    return Boolean(key && key !== CI_DUMMY_KEY) || explicit;
}
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
        if (!shouldRunIntegration()) {
            console.log("⏭️  Integration tests skipped (set STELLAR_PUBLIC_KEY or RUN_INTEGRATION_TESTS=1 to run)");
            return;
        }
        const publicKey = process.env.STELLAR_PUBLIC_KEY || "";
        const agent = new agent_1.AgentClient({ network: "testnet", publicKey });
        yield test("testnet read: lp.getReserves() returns without throwing", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield agent.lp.getReserves();
            if (result !== undefined && result !== null && !Array.isArray(result)) {
                throw new Error(`Expected array or null, got ${typeof result}`);
            }
        }));
        yield test("testnet read: lp.getShareId() returns without throwing", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield agent.lp.getShareId();
            if (result !== undefined && result !== null && typeof result !== "string") {
                throw new Error(`Expected string or null, got ${typeof result}`);
            }
        }));
        console.log(`\nIntegration: ${passed} passed, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    });
}
run();
