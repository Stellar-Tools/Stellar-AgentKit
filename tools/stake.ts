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
  schema: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("initialize"),
      tokenAddress: z.string().describe("The token address to be used for rewards"),
      rewardRate: z.number().describe("The rate of rewards issuance"),
      fromNetwork: z.enum(["stellar-testnet", "stellar-mainnet"]).default("stellar-testnet"),
    }),
    z.object({
      action: z.literal("stake"),
      amount: z.number().describe("The amount of tokens to stake"),
      fromNetwork: z.enum(["stellar-testnet", "stellar-mainnet"]).default("stellar-testnet"),
    }),
    z.object({
      action: z.literal("unstake"),
      amount: z.number().describe("The amount of tokens to unstake"),
      fromNetwork: z.enum(["stellar-testnet", "stellar-mainnet"]).default("stellar-testnet"),
    }),
    z.object({
      action: z.literal("claim_rewards"),
      fromNetwork: z.enum(["stellar-testnet", "stellar-mainnet"]).default("stellar-testnet"),
    }),
    z.object({
      action: z.literal("get_stake"),
      userAddress: z.string().describe("The user address to query stake for"),
      fromNetwork: z.enum(["stellar-testnet", "stellar-mainnet"]).default("stellar-testnet"),
    }),
  ]),
  func: async (input: any) => {
    const { action, tokenAddress, rewardRate, amount, userAddress, fromNetwork } = input;
    
    // Build dynamic config based on network
    const config = {
      networkPassphrase: fromNetwork === "stellar-mainnet" ? "Public Global Stellar Network ; October 2015" : "Test SDF Network ; September 2015",
      rpcUrl: fromNetwork === "stellar-mainnet" ? "https://soroban.stellar.org" : "https://soroban-testnet.stellar.org"
    };

    try {
      switch (action) {
        case "initialize": {
          const result = await initialize(STELLAR_PUBLIC_KEY, tokenAddress, rewardRate, config);
          return result ?? "Contract initialized successfully.";
        }

        case "stake": {
          const result = await stake(STELLAR_PUBLIC_KEY, amount, config);
          return result ?? `Staked ${amount} successfully.`;
        }

        case "unstake": {
          const result = await unstake(STELLAR_PUBLIC_KEY, amount, config);
          return result ?? `Unstaked ${amount} successfully.`;
        }

        case "claim_rewards": {
          const result = await claimRewards(STELLAR_PUBLIC_KEY, config);
          return result ?? "Rewards claimed successfully.";
        }

        case "get_stake": {
          const stakeAmount = await getStake(STELLAR_PUBLIC_KEY, userAddress, config);
          return stakeAmount;
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


