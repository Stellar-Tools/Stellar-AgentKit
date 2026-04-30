import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  initialize,
  stake,
  unstake,
  claimRewards,
  getStake,
} from "../lib/stakeF";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY || "";
const STELLAR_NETWORK = (process.env.STELLAR_NETWORK?.toLowerCase() || "testnet") as "testnet" | "mainnet";
const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 
  (STELLAR_NETWORK === "mainnet" 
    ? "https://soroban-mainnet.stellar.org" 
    : "https://soroban-testnet.stellar.org");

export const StellarContractTool = new DynamicStructuredTool({
  name: "stellar_contract_tool",
  description: "Interact with a staking contract on Stellar Soroban: initialize, stake, unstake, claim rewards, or get stake.",
  schema: z.object({
    action: z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
    tokenAddress: z.string().optional(),
    rewardRate: z.number().optional(),
    amount: z.number().optional(),
    userAddress: z.string().optional(),
    contractAddress: z.string().optional(),
  }),
  func: async (input: any) => {
    const { action, tokenAddress, rewardRate, amount, userAddress, contractAddress } = input;

    const config = {
      network: STELLAR_NETWORK,
      rpcUrl: SOROBAN_RPC_URL,
      contractAddress,
    };

    try {
      switch (action) {
        case "initialize": {
          if (!tokenAddress || rewardRate === undefined) {
            throw new Error("tokenAddress and rewardRate are required for initialize");
          }
          const result = await initialize(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate, config);
          return result ?? "Contract initialized successfully.";
        }
        case "stake": {
          if (amount === undefined) {
            throw new Error("amount is required for stake");
          }
          const result = await stake(STELLAR_PUBLIC_KEY, amount, config);
          return result ?? `Staked ${amount} successfully.`;
        }
        case "unstake": {
          if (amount === undefined) {
            throw new Error("amount is required for unstake");
          }
          const result = await unstake(STELLAR_PUBLIC_KEY, amount, config);
          return result ?? `Unstaked ${amount} successfully.`;
        }
        case "claim_rewards": {
          const result = await claimRewards(STELLAR_PUBLIC_KEY, config);
          return result ?? "Rewards claimed successfully.";
        }
        case "get_stake": {
          if (!userAddress) {
            throw new Error("userAddress is required for get_stake");
          }
          const stakeAmount = await getStake(STELLAR_PUBLIC_KEY, userAddress, config);
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