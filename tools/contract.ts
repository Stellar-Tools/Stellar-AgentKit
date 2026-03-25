import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getShareId,
  deposit,
  swap,
  withdraw,
  getReserves,
} from "../lib/contract";

const schema = z.object({
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

type Input = z.infer<typeof schema>;

export const StellarLiquidityContractTool = new DynamicStructuredTool({
  name: "stellar_liquidity_contract_tool",
  description:
    "Interact with a liquidity contract on Stellar Soroban: getShareId, deposit, swap, withdraw, getReserves.",
  schema,
  func: async (input: Input) => {
    const publicKey = process.env.STELLAR_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error(
        "[stellar_liquidity_contract_tool] Missing STELLAR_PUBLIC_KEY"
      );
    }

    try {
      switch (input.action) {
        case "get_share_id": {
          const result = await getShareId(publicKey);
          return result ?? "No share ID found.";
        }

        case "deposit": {
          if (
            !input.to ||
            !input.desiredA ||
            !input.minA ||
            !input.desiredB ||
            !input.minB
          ) {
            throw new Error("Missing deposit parameters");
          }

          const result = await deposit(
            publicKey,
            input.to,
            input.desiredA,
            input.minA,
            input.desiredB,
            input.minB
          );

          return result ?? `Deposited successfully to ${input.to}.`;
        }

        case "swap": {
          if (
            !input.to ||
            input.buyA === undefined ||
            !input.out ||
            !input.inMax
          ) {
            throw new Error("Missing swap parameters");
          }

          const result = await swap(
            publicKey,
            input.to,
            input.buyA,
            input.out,
            input.inMax
          );

          return result ?? `Swapped successfully to ${input.to}.`;
        }

        case "withdraw": {
          if (
            !input.to ||
            !input.shareAmount ||
            !input.minA ||
            !input.minB
          ) {
            throw new Error("Missing withdraw parameters");
          }

          const result = await withdraw(
            publicKey,
            input.to,
            input.shareAmount,
            input.minA,
            input.minB
          );

          return result
            ? `Withdrawn successfully to ${input.to}: ${JSON.stringify(result)}`
            : "Withdraw failed or returned no value.";
        }

        case "get_reserves": {
          const result = await getReserves(publicKey);

          return result
            ? `Reserves: ${JSON.stringify(result)}`
            : "No reserves found.";
        }

        default:
          throw new Error("Unsupported action");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      throw new Error(`[stellar_liquidity_contract_tool] ${message}`);
    }
  },
});
