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
const errors_1 = require("../lib/errors");
// Assuming env variables are already loaded elsewhere
const getPublicKey = () => process.env.STELLAR_PUBLIC_KEY;
exports.StellarLiquidityContractTool = new tools_1.DynamicStructuredTool({
    name: "stellar_liquidity_contract_tool",
    description: "Perform decentralized exchange (DEX) operations on Stellar liquidity pools. Use this for swapping assets, or for depositing and withdrawing liquidity. Supports getShareId, deposit, swap, withdraw, and getReserves.",
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
    func: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const { action, to, desiredA, minA, desiredB, minB, buyA, out, inMax, shareAmount, } = input;
        try {
            switch (action) {
                case "get_share_id": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    const result = yield (0, contract_1.getShareId)(publicKey);
                    return result !== null && result !== void 0 ? result : "No share ID found.";
                }
                case "deposit": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (!to || !desiredA || !minA || !desiredB || !minB) {
                        throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, "to, desiredA, minA, desiredB, and minB are required for deposit");
                    }
                    const result = yield (0, contract_1.deposit)(publicKey, to, desiredA, minA, desiredB, minB);
                    return result !== null && result !== void 0 ? result : `Deposited successfully to ${to}.`;
                }
                case "swap": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (!to || buyA === undefined || !out || !inMax) {
                        throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, "to, buyA, out, and inMax are required for swap");
                    }
                    const result = yield (0, contract_1.swap)(publicKey, to, buyA, out, inMax);
                    return result !== null && result !== void 0 ? result : `Swapped successfully to ${to}.`;
                }
                case "withdraw": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (!to || !shareAmount || !minA || !minB) {
                        throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, "to, shareAmount, minA, and minB are required for withdraw");
                    }
                    const result = yield (0, contract_1.withdraw)(publicKey, to, shareAmount, minA, minB);
                    return result
                        ? `Withdrawn successfully to ${to}: ${JSON.stringify(result)}`
                        : "Withdraw failed or returned no value.";
                }
                case "get_reserves": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    const result = yield (0, contract_1.getReserves)(publicKey);
                    return result
                        ? `Reserves: ${JSON.stringify(result)}`
                        : "No reserves found.";
                }
                default:
                    throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, "Unsupported action");
            }
        }
        catch (error) {
            if ((0, errors_1.isAgentKitError)(error))
                throw error;
            const msg = error instanceof Error ? error.message : String(error);
            console.error("StellarLiquidityContractTool error:", msg);
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, `Failed to execute ${action}: ${msg}`, undefined, error instanceof Error ? error : undefined);
        }
    }),
});
