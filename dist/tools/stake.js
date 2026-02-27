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
const getPublicKey = () => process.env.STELLAR_PUBLIC_KEY;
exports.StellarContractTool = new tools_1.DynamicStructuredTool({
    name: "stellar_contract_tool",
    description: "Interact with Stellar Staking Smart Contracts. Use this to initialize a staking pool, deposit assets to earn yield, unstake assets, or claim accrued rewards. Supports initialize, stake, unstake, claim_rewards, and get_stake.",
    schema: zod_1.z.object({
        action: zod_1.z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
        tokenAddress: zod_1.z.string().optional(), // Only for initialize
        rewardRate: zod_1.z.number().optional(), // Only for initialize
        amount: zod_1.z.number().optional(), // For stake/unstake
        userAddress: zod_1.z.string().optional(), // For get_stake
    }),
    func: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const { action, tokenAddress, rewardRate, amount, userAddress } = input;
        try {
            switch (action) {
                case "initialize": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (!tokenAddress || rewardRate === undefined) {
                        throw new Error("tokenAddress and rewardRate are required for initialize");
                    }
                    const result = yield (0, stakeF_1.initialize)(publicKey, tokenAddress, rewardRate);
                    return result !== null && result !== void 0 ? result : "Contract initialized successfully.";
                }
                case "stake": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (amount === undefined) {
                        throw new Error("amount is required for stake");
                    }
                    const result = yield (0, stakeF_1.stake)(publicKey, amount);
                    return result !== null && result !== void 0 ? result : `Staked ${amount} successfully.`;
                }
                case "unstake": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (amount === undefined) {
                        throw new Error("amount is required for unstake");
                    }
                    const result = yield (0, stakeF_1.unstake)(publicKey, amount);
                    return result !== null && result !== void 0 ? result : `Unstaked ${amount} successfully.`;
                }
                case "claim_rewards": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    const result = yield (0, stakeF_1.claimRewards)(publicKey);
                    return result !== null && result !== void 0 ? result : "Rewards claimed successfully.";
                }
                case "get_stake": {
                    const publicKey = getPublicKey();
                    if (!publicKey)
                        throw new Error("Missing STELLAR_PUBLIC_KEY");
                    if (!userAddress) {
                        throw new Error("userAddress is required for get_stake");
                    }
                    const stakeAmount = yield (0, stakeF_1.getStake)(publicKey, userAddress);
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
