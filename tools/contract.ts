import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";
import { AgentKitError, AgentKitErrorCode, isAgentKitError } from "../lib/errors";

// Assuming env variables are already loaded elsewhere
const getPublicKey = () => process.env.STELLAR_PUBLIC_KEY!;

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description: "Perform decentralized exchange (DEX) operations on Stellar liquidity pools. Use this for swapping assets, or for depositing and withdrawing liquidity. Supports getShareId, deposit, swap, withdraw, and getReserves.",
  schema: z.object({
    action: z.enum(["get_share_id", "deposit", "swap", "withdraw", "get_reserves"]),
    to: z.string().optional(), // For deposit, swap, withdraw
    desiredA: z.string().optional(), // For deposit
    minA: z.string().optional(), // For deposit, withdraw
    desiredB: z.string().optional(), // For deposit
    minB: z.string().optional(), // For deposit, withdraw
    buyA: z.boolean().optional(), // For swap
    out: z.string().optional(), // For swap
    inMax: z.string().optional(), // For swap
    shareAmount: z.string().optional(), // For withdraw
  }),
  func: async (input: unknown) => {
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
    } = input as {
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
    };
    try {
      switch (action) {
        case "get_share_id": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          const result = await getShareId(publicKey);
          return result ?? "No share ID found.";
        }
        case "deposit": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (!to || !desiredA || !minA || !desiredB || !minB) {
            throw new AgentKitError(
              AgentKitErrorCode.TOOL_EXECUTION_FAILED,
              "to, desiredA, minA, desiredB, and minB are required for deposit"
            );
          }
          const result = await deposit(publicKey, to, desiredA, minA, desiredB, minB);
          return result ??`Deposited successfully to ${to}.`;
        }
        case "swap": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (!to || buyA === undefined || !out || !inMax) {
            throw new AgentKitError(
              AgentKitErrorCode.TOOL_EXECUTION_FAILED,
              "to, buyA, out, and inMax are required for swap"
            );
          }
          const result=await swap(publicKey, to, buyA, out, inMax);
          return result ?? `Swapped successfully to ${to}.`;
        }
        case "withdraw": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          if (!to || !shareAmount || !minA || !minB) {
            throw new AgentKitError(
              AgentKitErrorCode.TOOL_EXECUTION_FAILED,
              "to, shareAmount, minA, and minB are required for withdraw"
            );
          }
          const result = await withdraw(publicKey, to, shareAmount, minA, minB);
          return result
            ? `Withdrawn successfully to ${to}: ${JSON.stringify(result)}`
            : "Withdraw failed or returned no value.";
        }
        case "get_reserves": {
          const publicKey = getPublicKey();
          if (!publicKey) throw new Error("Missing STELLAR_PUBLIC_KEY");
          const result = await getReserves(publicKey);
          return result
            ? `Reserves: ${JSON.stringify(result)}`
            : "No reserves found.";
        }
        default:
          throw new AgentKitError(AgentKitErrorCode.TOOL_EXECUTION_FAILED, "Unsupported action");
      }
    } catch (error: unknown) {
      if (isAgentKitError(error)) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("StellarLiquidityContractTool error:", msg);
      throw new AgentKitError(
        AgentKitErrorCode.TOOL_EXECUTION_FAILED,
        `Failed to execute ${action}: ${msg}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  },
});