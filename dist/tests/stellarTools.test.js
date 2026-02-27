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
const stellar_1 = require("../tools/stellar");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
let passed = 0;
let failed = 0;
const VALID_PUB = "GCIJXBAWJ72KM2C6FDKFRYUGJC3AU75LZDODIWKDS2QLMQQEPBCKICUU5";
const VALID_SEC = "SCHACD52BC3UPDCWGGQNOTYOFEQP35HVP76EIKGS37O7655S3PCHEDH6";
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
function expect(actual, label) {
    return {
        toContain: (sub) => {
            const act = String(actual).toLowerCase();
            const s = sub.toLowerCase();
            if (!act.includes(s)) {
                throw new Error(`${label || 'Value'} expected to contain "${sub}", got "${actual}"`);
            }
        },
    };
}
function runTests() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Running Stellar Tools Tests...\n");
        yield test("stellar_send_payment: invalid recipient", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield stellar_1.stellarSendPaymentTool.invoke({
                recipient: "bad-address",
                amount: "10",
            });
            expect(result, "Result").toContain("recipient address");
        }));
        yield test("stellar_send_payment: invalid amount (zero)", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield stellar_1.stellarSendPaymentTool.invoke({
                recipient: VALID_PUB,
                amount: "0",
            });
            expect(result, "Result").toContain("positive number");
        }));
        yield test("stellar_send_payment: invalid amount (negative)", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield stellar_1.stellarSendPaymentTool.invoke({
                recipient: VALID_PUB,
                amount: "-1",
            });
            expect(result, "Result").toContain("positive number");
        }));
        yield test("stellar_send_payment: non-numeric amount", () => __awaiter(this, void 0, void 0, function* () {
            const result = yield stellar_1.stellarSendPaymentTool.invoke({
                recipient: VALID_PUB,
                amount: "abc",
            });
            expect(result, "Result").toContain("positive number");
        }));
        yield test("stellar_send_payment: missing private key", () => __awaiter(this, void 0, void 0, function* () {
            const oldKey = process.env.STELLAR_PRIVATE_KEY;
            delete process.env.STELLAR_PRIVATE_KEY;
            try {
                const result = yield stellar_1.stellarSendPaymentTool.invoke({
                    recipient: VALID_PUB,
                    amount: "10",
                });
                expect(result, "Result").toContain("private key");
            }
            finally {
                process.env.STELLAR_PRIVATE_KEY = oldKey;
            }
        }));
        console.log(`\nStellar Tools tests: ${passed} passed, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    });
}
runTests();
