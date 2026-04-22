import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";

// Lazy getters — defer env-var checks to invocation time so that importing
// this module doesn't crash consumers without a fully configured environment.
function getStellarPublicKey(): string {
  const key = process.env.STELLAR_PUBLIC_KEY;
  if (!key) throw new Error("Missing STELLAR_PUBLIC_KEY environment variable");
  return key;
}
function getStellarNetwork(): "testnet" | "mainnet" {
  const net = process.env.STELLAR_NETWORK;
  return net === "mainnet" ? "mainnet" : "testnet";
}
function getSorobanRpcUrl(): string {
  return process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
}

const schema = z.object({
  action: z.enum(["get_share_id", "deposit", "swap", "withdraw", "get_reserves"]),
  to: z.string().optional(),
  desiredA: z.string().optional(),
  minA: z.string().optional(),
  desiredB: z.string().optional(),
  minB: z.string().optional(),
  buyA: z.boolean().optional(),
  out: z.string().optional(),
  inMax: z.string().optional(),
  shareAmount: z.string().optional(),
  contractAddress: z.string().optional(),
});

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description:
    "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
  schema,
  func: async (input: z.infer<typeof schema>) => {
    const STELLAR_PUBLIC_KEY = getStellarPublicKey();
    const STELLAR_NETWORK    = getStellarNetwork();
    const SOROBAN_RPC_URL    = getSorobanRpcUrl();

    const {
      action,
      to,
      desiredA,
      minA,
      desiredB,
      minB,
      buyA,
      out,
      inMax,
      shareAmount,
      contractAddress,
    } = input;

    const config = {
      network: STELLAR_NETWORK,
      rpcUrl: SOROBAN_RPC_URL,
      ...(contractAddress && { contractAddress }),
    };
    
    try {
      switch (action) {
        case "get_share_id": {
          const result = await getShareId(STELLAR_PUBLIC_KEY, config);
          return result ?? "No share ID found.";
        }
        case "deposit": {
          if (!to || !desiredA || !minA || !desiredB || !minB) {
            throw new Error("to, desiredA, minA, desiredB, and minB are required for deposit");
          }
          const result = await deposit(STELLAR_PUBLIC_KEY, to, desiredA, minA, desiredB, minB, config);
          return result
            ? `Deposited to ${to}: ${JSON.stringify(result)}`
            : "Deposit returned no value.";
        }
        case "swap": {
          if (!to || buyA == null || !out || !inMax) {
            throw new Error("to, buyA, out, and inMax are required for swap");
          }
          const result = await swap(STELLAR_PUBLIC_KEY, to, buyA, out, inMax, config);
          return result
            ? `Swapped to ${to}: ${JSON.stringify(result)}`
            : "Swap returned no value.";
        }
        case "withdraw": {
          if (!to || !shareAmount || !minA || !minB) {
            throw new Error("to, shareAmount, minA, and minB are required for withdraw");
          }
          const result = await withdraw(STELLAR_PUBLIC_KEY, to, shareAmount, minA, minB, config);
          return result
            ? `Withdrawn successfully to ${to}: ${JSON.stringify(result)}`
            : "Withdraw failed or returned no value.";
        }
        case "get_reserves": {
          const result = await getReserves(STELLAR_PUBLIC_KEY, config);
          return result
            ? `Reserves: ${JSON.stringify(result)}`
            : "No reserves found.";
        }
        default:
          throw new Error("Unsupported action");
      }
    } catch (error: any) {
      console.error("StellarLiquidityContractTool error:", error.message);
      throw new Error(`Failed to execute ${action}: ${error.message}`);
    }
  },
});
