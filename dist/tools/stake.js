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
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;
if (!STELLAR_PUBLIC_KEY) {
    throw new Error("Missing STELLAR_PUBLIC_KEY in environment variables");
}
const stakingToolSchema = zod_1.z.object({
    action: zod_1.z.enum([
        "initialize",
        "stake",
        "unstake",
        "claim_rewards",
        "get_stake",
    ]),
    tokenAddress: zod_1.z.string().optional(),
    rewardRate: zod_1.z.number().optional(),
    amount: zod_1.z.number().optional(),
    userAddress: zod_1.z.string().optional(),
});
exports.StellarContractTool = new tools_1.DynamicStructuredTool({
    name: "stellar_contract_tool",
    description: "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",
    schema: stakingToolSchema,
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ action, tokenAddress, rewardRate, amount, userAddress, }) {
        try {
            switch (action) {
                case "initialize": {
                    if (!tokenAddress || rewardRate === undefined) {
                        throw new Error("initialize requires: tokenAddress and rewardRate");
                    }
                    yield (0, stakeF_1.initialize)(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate);
                    return "Contract initialized successfully.";
                }
                case "stake": {
                    if (amount === undefined) {
                        throw new Error("stake requires: amount");
                    }
                    yield (0, stakeF_1.stake)(STELLAR_PUBLIC_KEY, amount);
                    return `Staked ${amount} successfully.`;
                }
                case "unstake": {
                    if (amount === undefined) {
                        throw new Error("unstake requires: amount");
                    }
                    yield (0, stakeF_1.unstake)(STELLAR_PUBLIC_KEY, amount);
                    return `Unstaked ${amount} successfully.`;
                }
                case "claim_rewards": {
                    yield (0, stakeF_1.claimRewards)(STELLAR_PUBLIC_KEY);
                    return "Rewards claimed successfully.";
                }
                case "get_stake": {
                    if (!userAddress) {
                        throw new Error("get_stake requires: userAddress");
                    }
                    const stakeAmount = yield (0, stakeF_1.getStake)(STELLAR_PUBLIC_KEY, userAddress);
                    return `Stake for ${userAddress}: ${stakeAmount}`;
                }
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new Error(`[stellar_contract_tool] Failed to execute ${action}: ${message}`);
        }
    }),
});
