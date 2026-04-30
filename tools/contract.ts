import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  withdraw,
  getReserves,
  swap as contractSwap,
} from "../lib/contract";

const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY || "";
const STELLAR_NETWORK = (process.env.STELLAR_NETWORK?.toLowerCase() || "testnet") as "testnet" | "mainnet";
const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 
  (STELLAR_NETWORK === "mainnet" 
    ? "https://soroban-mainnet.stellar.org" 
    : "https://soroban-testnet.stellar.org");

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description: "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
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
    contractAddress: z.string().optional(),
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
      contractAddress,
    } = input;

    const config = {
      network: STELLAR_NETWORK,
      rpcUrl: SOROBAN_RPC_URL,
      contractAddress,
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
          return result ?? `Deposited successfully to ${to}.`;
        }
        case "swap": {
          if (!to || buyA === undefined || !out || !inMax) {
            throw new Error("to, buyA, out, and inMax are required for swap");
          }
          const result = await contractSwap(STELLAR_PUBLIC_KEY, to, buyA, out, inMax, config);
          return result ?? `Swapped successfully for ${to}.`;
        }
        case "withdraw": {
          if (!to || !shareAmount || !minA || !minB) {
            throw new Error("to, shareAmount, minA, and minB are required for withdraw");
          }
          const result = await withdraw(STELLAR_PUBLIC_KEY, to, shareAmount, minA, minB, config);
          return result ?? `Withdrawn successfully to ${to}.`;
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
      throw new Error(`Failed to execute ${action}: ${error.message}`);
    }
  },
});