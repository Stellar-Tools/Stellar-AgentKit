import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  initialize,
  stake,
  unstake,
  claimRewards,
  getStake,
} from "../lib/stakeF";

// Assuming env variables are already loaded elsewhere
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY!;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing Stellar environment variables");
}

export const StellarContractTool = new DynamicStructuredTool({
  name: "stellar_contract_tool",
  description:
    "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",
  schema: z.object({
    action: z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
    tokenAddress: z.string().optional(), // Only for initialize
    rewardRate: z.number().optional(), // Only for initialize
    amount: z.number().optional(), // For stake/unstake
    userAddress: z.string().optional(), // For get_stake
  }),
  func: async (input: any) => {
    const { action, tokenAddress, rewardRate, amount, userAddress } = input;
    try {
      switch (action) {
        case "initialize": {
          if (!tokenAddress || rewardRate === undefined) {
            throw new Error("tokenAddress and rewardRate are required for initialize");
          }
          const result = await initialize(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate);
          return result ?? "Contract initialized successfully.";
        }

        case "stake": {
          if (amount === undefined) {
            throw new Error("amount is required for stake");
          }
          const result = await stake(STELLAR_PUBLIC_KEY, amount);
          return result ?? `Staked ${amount} successfully.`;
        }

        case "unstake": {
          if (amount === undefined) {
            throw new Error("amount is required for unstake");
          }
          const result = await unstake(STELLAR_PUBLIC_KEY, amount);
          return result ?? `Unstaked ${amount} successfully.`;
        }

        case "claim_rewards": {
          const result = await claimRewards(STELLAR_PUBLIC_KEY);
          return result ?? "Rewards claimed successfully.";
        }

        case "get_stake": {
          if (!userAddress) {
            throw new Error("userAddress is required for get_stake");
          }
          const stakeAmount = await getStake(STELLAR_PUBLIC_KEY, userAddress);
          return `Stake for ${userAddress}: ${stakeAmount}`;
        }

        default:
          throw new Error("Unsupported action");
      }
    } catch (error: any) {
      console.error("StellarContractTool error:", error.message);
      throw new Error(`Failed to execute ${action}: ${error.message}`);
    }
  },
});


