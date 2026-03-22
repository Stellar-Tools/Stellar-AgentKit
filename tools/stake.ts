import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  initialize,
  stake,
  unstake,
  claimRewards,
  getStake,
} from "../lib/stakeF";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing STELLAR_PUBLIC_KEY in environment variables");
}

const stakingToolSchema = z.object({
  action: z.enum([
    "initialize",
    "stake",
    "unstake",
    "claim_rewards",
    "get_stake",
  ]),
  tokenAddress: z.string().optional(),
  rewardRate: z.number().optional(),
  amount: z.number().optional(),
  userAddress: z.string().optional(),
});

export const StellarContractTool = new DynamicStructuredTool({
  name: "stellar_contract_tool",
  description:
    "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",
  schema: stakingToolSchema,

  func: async ({
    action,
    tokenAddress,
    rewardRate,
    amount,
    userAddress,
  }: z.infer<typeof stakingToolSchema>) => {
    try {
      switch (action) {
        case "initialize": {
          if (!tokenAddress || rewardRate === undefined) {
            throw new Error(
              "initialize requires: tokenAddress and rewardRate"
            );
          }

          await initialize(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate);
          return "Contract initialized successfully.";
        }

        case "stake": {
          if (amount === undefined) {
            throw new Error("stake requires: amount");
          }

          await stake(STELLAR_PUBLIC_KEY, amount);
          return `Staked ${amount} successfully.`;
        }

        case "unstake": {
          if (amount === undefined) {
            throw new Error("unstake requires: amount");
          }

          await unstake(STELLAR_PUBLIC_KEY, amount);
          return `Unstaked ${amount} successfully.`;
        }

        case "claim_rewards": {
          await claimRewards(STELLAR_PUBLIC_KEY);
          return "Rewards claimed successfully.";
        }

        case "get_stake": {
          if (!userAddress) {
            throw new Error("get_stake requires: userAddress");
          }

          const stakeAmount = await getStake(STELLAR_PUBLIC_KEY, userAddress);
          return `Stake for ${userAddress}: ${stakeAmount}`;
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      throw new Error(
        `[stellar_contract_tool] Failed to execute ${action}: ${message}`
      );
    }
  },
});