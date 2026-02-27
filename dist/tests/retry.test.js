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
const retry_1 = require("../utils/retry");
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
            console.log(`❌ ${name}\n   → ${e instanceof Error ? e.message : String(e)}`);
            failed++;
        }
    });
    return run();
}
function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected)
                throw new Error(`Expected ${expected}, got ${actual}`);
        },
    };
}
function runTests() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Running Retry Utility Tests...\n");
        yield test("withRetry: succeeds on first attempt", () => __awaiter(this, void 0, void 0, function* () {
            let callCount = 0;
            const result = yield (0, retry_1.withRetry)(() => __awaiter(this, void 0, void 0, function* () {
                callCount++;
                return "success";
            }));
            expect(result).toBe("success");
            expect(callCount).toBe(1);
        }));
        yield test("withRetry: retries on retryable error and succeeds", () => __awaiter(this, void 0, void 0, function* () {
            let callCount = 0;
            const result = yield (0, retry_1.withRetry)(() => __awaiter(this, void 0, void 0, function* () {
                callCount++;
                if (callCount < 3) {
                    throw new Error("Network timeout");
                }
                return "success";
            }), { initialDelayMs: 10, maxRetries: 3 });
            expect(result).toBe("success");
            expect(callCount).toBe(3);
        }));
        yield test("withRetry: fails after max retries", () => __awaiter(this, void 0, void 0, function* () {
            let callCount = 0;
            try {
                yield (0, retry_1.withRetry)(() => __awaiter(this, void 0, void 0, function* () {
                    callCount++;
                    throw new Error("Rate limit exceeded");
                }), { initialDelayMs: 10, maxRetries: 2 });
                throw new Error("Should have thrown");
            }
            catch (e) {
                expect(e.message).toBe("Rate limit exceeded");
                expect(callCount).toBe(3); // 1 original + 2 retries
            }
        }));
        yield test("withRetry: fails immediately on non-retryable error", () => __awaiter(this, void 0, void 0, function* () {
            let callCount = 0;
            try {
                yield (0, retry_1.withRetry)(() => __awaiter(this, void 0, void 0, function* () {
                    callCount++;
                    throw new Error("Invalid parameters");
                }), { initialDelayMs: 10, maxRetries: 3 });
                throw new Error("Should have thrown");
            }
            catch (e) {
                expect(e.message).toBe("Invalid parameters");
                expect(callCount).toBe(1);
            }
        }));
        console.log(`\nRetry Utility tests: ${passed} passed, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    });
}
runTests();
