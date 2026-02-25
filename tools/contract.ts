import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY!;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing Stellar environment variables");
}

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description:
    "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
  schema: z.object({
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
  }),
  func: async (input: {
    action: "get_share_id" | "deposit" | "swap" | "withdraw" | "get_reserves";
    to?: string;
    desiredA?: string;
    minA?: string;
    desiredB?: string;
    minB?: string;
    buyA?: boolean;
    out?: string;
    inMax?: string;
    shareAmount?: string;
  }) => {
    const { action, to, desiredA, minA, desiredB, minB, buyA, out, inMax, shareAmount } = input;
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
          return result ?? `Deposited successfully to ${to}.`;
        }
        case "swap": {
          if (!to || buyA === undefined || !out || !inMax) {
            throw new Error("to, buyA, out, and inMax are required for swap");
          }
          const result = await swap(STELLAR_PUBLIC_KEY, to, buyA, out, inMax);
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
          return result ? `Reserves: ${JSON.stringify(result)}` : "No reserves found.";
        }
        default:
          throw new Error("Unsupported action");
      }
    } catch (error: unknown) {
      const msg = (error as Error).message ?? "Unknown error";
      throw new Error(`Failed to execute ${action}: ${msg}`);
    }
  },
});
