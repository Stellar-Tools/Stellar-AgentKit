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
const getPublicKey = () => process.env.STELLAR_PUBLIC_KEY!;

export const StellarContractTool = new DynamicStructuredTool({
  name: "stellar_contract_tool",
  description: "Interact with Stellar Staking Smart Contracts. Use this to initialize a staking pool, deposit assets to earn yield, unstake assets, or claim accrued rewards. Supports initialize, stake, unstake, claim_rewards, and get_stake.",
  schema: z.object({
    action: z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
    tokenAddress: z.string().optional(), // Only for initialize
    rewardRate: z.number().optional(), // Only for initialize
    amount: z.number().optional(), // For stake/unstake
    userAddress: z.string().optional(), // For get_stake
  }),
  func: async (input: unknown) => {
    const { action, tokenAddress, rewardRate, amount, userAddress } = input as {
      action: "initialize" | "stake" | "unstake" | "claim_rewards" | "get_stake";
      tokenAddress?: string;
      rewardRate?: number;
      amount?: number;
      userAddress?: string;
    };
    try {
      switch (action) {
        case "initialize": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (!tokenAddress || rewardRate === undefined) {
            throw new Error("tokenAddress and rewardRate are required for initialize");
          }
          const result = await initialize(publicKey, tokenAddress, rewardRate);
          return result ?? "Contract initialized successfully.";
        }

        case "stake": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (amount === undefined) {
            throw new Error("amount is required for stake");
          }
          const result = await stake(publicKey, amount);
          return result ?? `Staked ${amount} successfully.`;
        }

        case "unstake": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (amount === undefined) {
            throw new Error("amount is required for unstake");
          }
          const result = await unstake(publicKey, amount);
          return result ?? `Unstaked ${amount} successfully.`;
        }

        case "claim_rewards": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          const result = await claimRewards(publicKey);
          return result ?? "Rewards claimed successfully.";
        }

        case "get_stake": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (!userAddress) {
            throw new Error("userAddress is required for get_stake");
          }
          const stakeAmount = await getStake(publicKey, userAddress);
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


