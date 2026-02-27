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
exports.StellarContractTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const stakeF_1 = require("../lib/stakeF");
// Assuming env variables are already loaded elsewhere
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;
if (!STELLAR_PUBLIC_KEY) {
    throw new Error("Missing Stellar environment variables");
}
exports.StellarContractTool = new tools_1.DynamicStructuredTool({
    name: "stellar_contract_tool",
    description: "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",
    schema: zod_1.z.object({
        action: zod_1.z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
        tokenAddress: zod_1.z.string().optional(), // Only for initialize
        rewardRate: zod_1.z.number().optional(), // Only for initialize
        amount: zod_1.z.number().optional(), // For stake/unstake
        userAddress: zod_1.z.string().optional(), // For get_stake
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ action, tokenAddress, rewardRate, amount, userAddress }) {
        try {
            switch (action) {
                case "initialize": {
                    if (!tokenAddress || rewardRate === undefined) {
                        throw new Error("tokenAddress and rewardRate are required for initialize");
                    }
                    const result = yield (0, stakeF_1.initialize)(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate);
                    return result !== null && result !== void 0 ? result : "Contract initialized successfully.";
                }
                case "stake": {
                    if (amount === undefined) {
                        throw new Error("amount is required for stake");
                    }
                    const result = yield (0, stakeF_1.stake)(STELLAR_PUBLIC_KEY, amount);
                    return result !== null && result !== void 0 ? result : `Staked ${amount} successfully.`;
                }
                case "unstake": {
                    if (amount === undefined) {
                        throw new Error("amount is required for unstake");
                    }
                    const result = yield (0, stakeF_1.unstake)(STELLAR_PUBLIC_KEY, amount);
                    return result !== null && result !== void 0 ? result : `Unstaked ${amount} successfully.`;
                }
                case "claim_rewards": {
                    const result = yield (0, stakeF_1.claimRewards)(STELLAR_PUBLIC_KEY);
                    return result !== null && result !== void 0 ? result : "Rewards claimed successfully.";
                }
                case "get_stake": {
                    if (!userAddress) {
                        throw new Error("userAddress is required for get_stake");
                    }
                    const stakeAmount = yield (0, stakeF_1.getStake)(STELLAR_PUBLIC_KEY, userAddress);
                    return `Stake for ${userAddress}: ${stakeAmount}`;
                }
                default:
                    throw new Error("Unsupported action");
            }
        }
        catch (error) {
            console.error("StellarContractTool error:", error.message);
            throw new Error(`Failed to execute ${action}: ${error.message}`);
        }
    }),
});
