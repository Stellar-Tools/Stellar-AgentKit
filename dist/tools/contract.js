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
exports.StellarLiquidityContractTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const contract_1 = require("../lib/contract");
// Assuming env variables are already loaded elsewhere
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;
if (!STELLAR_PUBLIC_KEY) {
    throw new Error("Missing Stellar environment variables");
}
exports.StellarLiquidityContractTool = new tools_1.DynamicStructuredTool({
    name: "stellar_liquidity_contract_tool",
    description: "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
    schema: zod_1.z.object({
        action: zod_1.z.enum(["get_share_id", "deposit", "swap", "withdraw", "get_reserves"]),
        to: zod_1.z.string().optional(), // For deposit, swap, withdraw
        desiredA: zod_1.z.string().optional(), // For deposit
        minA: zod_1.z.string().optional(), // For deposit, withdraw
        desiredB: zod_1.z.string().optional(), // For deposit
        minB: zod_1.z.string().optional(), // For deposit, withdraw
        buyA: zod_1.z.boolean().optional(), // For swap
        out: zod_1.z.string().optional(), // For swap
        inMax: zod_1.z.string().optional(), // For swap
        shareAmount: zod_1.z.string().optional(), // For withdraw
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ action, to, desiredA, minA, desiredB, minB, buyA, out, inMax, shareAmount, }) {
        try {
            switch (action) {
                case "get_share_id": {
                    const result = yield (0, contract_1.getShareId)(STELLAR_PUBLIC_KEY);
                    return result !== null && result !== void 0 ? result : "No share ID found.";
                }
                case "deposit": {
                    if (!to || !desiredA || !minA || !desiredB || !minB) {
                        throw new Error("to, desiredA, minA, desiredB, and minB are required for deposit");
                    }
                    const result = yield (0, contract_1.deposit)(STELLAR_PUBLIC_KEY, to, desiredA, minA, desiredB, minB);
                    return result !== null && result !== void 0 ? result : `Deposited successfully to ${to}.`;
                }
                case "swap": {
                    if (!to || buyA === undefined || !out || !inMax) {
                        throw new Error("to, buyA, out, and inMax are required for swap");
                    }
                    const result = yield (0, contract_1.swap)(STELLAR_PUBLIC_KEY, to, buyA, out, inMax);
                    return result !== null && result !== void 0 ? result : `Swapped successfully to ${to}.`;
                }
                case "withdraw": {
                    if (!to || !shareAmount || !minA || !minB) {
                        throw new Error("to, shareAmount, minA, and minB are required for withdraw");
                    }
                    const result = yield (0, contract_1.withdraw)(STELLAR_PUBLIC_KEY, to, shareAmount, minA, minB);
                    return result
                        ? `Withdrawn successfully to ${to}: ${JSON.stringify(result)}`
                        : "Withdraw failed or returned no value.";
                }
                case "get_reserves": {
                    const result = yield (0, contract_1.getReserves)(STELLAR_PUBLIC_KEY);
                    return result
                        ? `Reserves: ${JSON.stringify(result)}`
                        : "No reserves found.";
                }
                default:
                    throw new Error("Unsupported action");
            }
        }
        catch (error) {
            console.error("StellarLiquidityContractTool error:", error.message);
            throw new Error(`Failed to execute ${action}: ${error.message}`);
        }
    }),
});
