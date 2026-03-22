import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;

if (!STELLAR_PUBLIC_KEY) {
  throw new Error("Missing STELLAR_PUBLIC_KEY in environment variables");
}

const liquidityToolSchema = z.object({
  action: z.enum([
    "get_share_id",
    "deposit",
    "swap",
    "withdraw",
    "get_reserves",
  ]),
  to: z.string().optional(),
  desiredA: z.string().optional(),
  minA: z.string().optional(),
  desiredB: z.string().optional(),
  minB: z.string().optional(),
  buyA: z.boolean().optional(),
  out: z.string().optional(),
  inMax: z.string().optional(),
  shareAmount: z.string().optional(),
});

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description:
    "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
  schema: liquidityToolSchema,

  func: async ({
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
  }: z.infer<typeof liquidityToolSchema>) => {
    try {
      switch (action) {
        case "get_share_id": {
          const result = await getShareId(STELLAR_PUBLIC_KEY);
          return result ?? "No share ID found.";
        }

        case "deposit": {
          if (!to || !desiredA || !minA || !desiredB || !minB) {
            throw new Error(
              "deposit requires: to, desiredA, minA, desiredB, and minB"
            );
          }

          await deposit(
            STELLAR_PUBLIC_KEY,
            to,
            desiredA,
            minA,
            desiredB,
            minB
          );

          return `Deposited successfully to ${to}.`;
        }

        case "swap": {
          if (!to || buyA === undefined || !out || !inMax) {
            throw new Error("swap requires: to, buyA, out, and inMax");
          }

          await swap(STELLAR_PUBLIC_KEY, to, buyA, out, inMax);

          return `Swapped successfully to ${to}.`;
        }

        case "withdraw": {
          if (!to || !shareAmount || !minA || !minB) {
            throw new Error(
              "withdraw requires: to, shareAmount, minA, and minB"
            );
          }

          const result = await withdraw(
            STELLAR_PUBLIC_KEY,
            to,
            shareAmount,
            minA,
            minB
          );

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
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `[stellar_liquidity_contract_tool] Failed to execute ${action}: ${message}`
      );
    }
  },
});