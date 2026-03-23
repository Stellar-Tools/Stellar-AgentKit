import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  initialize,
  stake,
  unstake,
  claimRewards,
  getStake,
} from "../lib/stakeF";

const schema = z.object({
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

type Input = z.infer<typeof schema>;

export const StellarContractTool = new DynamicStructuredTool({
  name: "stellar_contract_tool",
  description:
    "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",

  schema,

  func: async (input: Input) => {
    const publicKey = process.env.STELLAR_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error("[stellar_contract_tool] Missing STELLAR_PUBLIC_KEY");
    }

    try {
      switch (input.action) {
        case "initialize": {
          if (!input.tokenAddress || input.rewardRate === undefined) {
            throw new Error(
              "initialize requires: tokenAddress and rewardRate"
            );
          }

          const result = await initialize(
            publicKey,
            input.tokenAddress,
            input.rewardRate
          );

          return result ?? "Contract initialized successfully.";
        }

        case "stake": {
          if (input.amount === undefined) {
            throw new Error("stake requires: amount");
          }

          const result = await stake(publicKey, input.amount);
          return result ?? `Staked ${input.amount} successfully.`;
        }

        case "unstake": {
          if (input.amount === undefined) {
            throw new Error("unstake requires: amount");
          }

          const result = await unstake(publicKey, input.amount);
          return result ?? `Unstaked ${input.amount} successfully.`;
        }

        case "claim_rewards": {
          const result = await claimRewards(publicKey);
          return result ?? "Rewards claimed successfully.";
        }

        case "get_stake": {
          if (!input.userAddress) {
            throw new Error("get_stake requires: userAddress");
          }

          const stakeAmount = await getStake(publicKey, input.userAddress);
          return `Stake for ${input.userAddress}: ${stakeAmount}`;
        }

        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      throw new Error(`[stellar_contract_tool] ${message}`);
    }
  },
});