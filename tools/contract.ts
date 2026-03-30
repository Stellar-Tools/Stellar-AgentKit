import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AgentClient } from "../agent";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";

// Assuming env variables are already loaded elsewhere
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY!;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing Stellar environment variables");
}

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description:
    "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
  schema: z.object({
    action: z.enum(["get_share_id", "deposit", "swap", "withdraw", "get_reserves", "routed_swap"]),
    to: z.string().optional(), // For deposit, swap, withdraw
    desiredA: z.string().optional(), // For deposit
    minA: z.string().optional(), // For deposit, withdraw
    desiredB: z.string().optional(), // For deposit
    minB: z.string().optional(), // For deposit, withdraw
    buyA: z.boolean().optional(), // For swap
    out: z.string().optional(), // For swap
    inMax: z.string().optional(), // For swap
    shareAmount: z.string().optional(), // For withdraw
    tokenIn: z.string().optional(),
    tokenOut: z.string().optional(),
    amount: z.string().optional(),
    slippage: z.number().optional(),
    maxHops: z.number().optional(),
  }),
  func: async (input: any) => {
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
    } = input;
    try {
      switch (action) {
        case "get_share_id": {
          const result = await getShareId(STELLAR_PUBLIC_KEY);
          return result ?? "No share ID found.";
        }
        case "deposit": {
          if (!to || !desiredA || !minA || !desiredB || !minB) {
            throw new Error("to, desiredA, minA, desiredB, and minB are required for deposit");
          }
          const result = await deposit(STELLAR_PUBLIC_KEY, to, desiredA, minA, desiredB, minB);
          return result ??`Deposited successfully to ${to}.`;
        }
        case "swap": {
          if (!to || buyA === undefined || !out || !inMax) {
            throw new Error("to, buyA, out, and inMax are required for swap");
          }
          const result=await swap(STELLAR_PUBLIC_KEY, to, buyA, out, inMax);
          return result ?? `Swapped successfully to ${to}.`;
        }
        case "withdraw": {
          if (!to || !shareAmount || !minA || !minB) {
            throw new Error("to, shareAmount, minA, and minB are required for withdraw");
          }
          const result = await withdraw(STELLAR_PUBLIC_KEY, to, shareAmount, minA, minB);
          return result
            ? `Withdrawn successfully to ${to}: ${JSON.stringify(result)}`
            : "Withdraw failed or returned no value.";
        }
        case "get_reserves": {
          const result = await getReserves(STELLAR_PUBLIC_KEY);
          return result
            ? `Reserves: ${JSON.stringify(result)}`
            : "No reserves found.";
        }
        case "routed_swap": {
          if (!input.tokenIn || !input.tokenOut || !input.amount) {
            throw new Error("tokenIn, tokenOut, and amount are required for routed_swap");
          }
          const agent = new AgentClient({
            network: "testnet",
            publicKey: STELLAR_PUBLIC_KEY,
          });
          const result = await agent.swap({
            tokenIn: input.tokenIn,
            tokenOut: input.tokenOut,
            amount: input.amount,
            slippage: input.slippage ?? 0.5,
            strategy: "best-route" as const,
            maxHops: input.maxHops ?? 3,
          });
          return `Routed swap complete: ${JSON.stringify(result)}`;
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