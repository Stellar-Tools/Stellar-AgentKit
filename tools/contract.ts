import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
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
  schema: z.discriminatedUnion("action", [
    z.object({ action: z.literal("get_share_id") }),
    z.object({
      action: z.literal("deposit"),
      to: z.string().describe("Recipient address"),
      desiredA: z.string().describe("Desired amount of asset A"),
      minA: z.string().describe("Minimum amount of asset A"),
      desiredB: z.string().describe("Desired amount of asset B"),
      minB: z.string().describe("Minimum amount of asset B"),
    }),
    z.object({
      action: z.literal("swap"),
      to: z.string().describe("Recipient address"),
      buyA: z.boolean().describe("True if buying A, false if buying B"),
      out: z.string().describe("Amount to receive"),
      inMax: z.string().describe("Maximum amount to send"),
    }),
    z.object({
      action: z.literal("withdraw"),
      to: z.string().describe("Recipient address"),
      shareAmount: z.string().describe("Amount of share tokens to burn"),
      minA: z.string().describe("Minimum amount of asset A to receive"),
      minB: z.string().describe("Minimum amount of asset B to receive"),
    }),
    z.object({ action: z.literal("get_reserves") }),
  ]),
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
        default:
          throw new Error("Unsupported action");
      }
    } catch (error: any) {
      console.error("StellarLiquidityContractTool error:", error.message);
      throw new Error(`Failed to execute ${action}: ${error.message}`);
    }
  },
});