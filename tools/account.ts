import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getAccountInfo,
  getBalances,
  getTransactionHistory,
  getOperationHistory,
  fundTestnetAccount,
} from "../lib/account";

/**
 * Stellar Account Explorer Tool
 *
 * A read-only tool that allows AI agents to query Stellar account data:
 * - Account details (balances, signers, thresholds, flags)
 * - Balance summary
 * - Transaction history
 * - Operation history
 * - Testnet account funding via Friendbot
 *
 * This tool does NOT require a private key — all actions are read-only
 * Horizon API calls (except friendbot funding, which is testnet-only).
 */
export const StellarAccountTool = new DynamicStructuredTool({
  name: "stellar_account_tool",
  description:
    "Query Stellar account information: balances, transaction history, operation history, " +
    "account details (signers, thresholds, flags), and fund testnet accounts via Friendbot. " +
    "All actions are read-only except 'fund_testnet' which funds a testnet account with test XLM.",
  schema: z.object({
    action: z
      .enum([
        "get_info",
        "get_balances",
        "get_transactions",
        "get_operations",
        "fund_testnet",
      ])
      .describe(
        "The action to perform: " +
        "'get_info' — full account details; " +
        "'get_balances' — balance summary; " +
        "'get_transactions' — recent transaction history; " +
        "'get_operations' — recent operation history; " +
        "'fund_testnet' — fund a testnet account with Friendbot"
      ),
    publicKey: z
      .string()
      .describe("The Stellar public key (G-address) to query"),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Which Stellar network to query"),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe("Maximum number of records to return (1–50, default 10)"),
    order: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order: 'desc' (newest first) or 'asc' (oldest first)"),
  }),
  func: async (input: {
    action: string;
    publicKey: string;
    network?: "testnet" | "mainnet";
    limit?: number;
    order?: "asc" | "desc";
  }) => {
    const network = input.network ?? "testnet";
    const config = { network };

    try {
      switch (input.action) {
        case "get_info": {
          const info = await getAccountInfo(input.publicKey, config);
          return JSON.stringify(info, null, 2);
        }

        case "get_balances": {
          const balances = await getBalances(input.publicKey, config);
          if (balances.length === 0) {
            return "No balances found for this account.";
          }
          return JSON.stringify(balances, null, 2);
        }

        case "get_transactions": {
          const transactions = await getTransactionHistory(
            input.publicKey,
            config,
            input.limit ?? 10,
            input.order ?? "desc"
          );
          if (transactions.length === 0) {
            return "No transactions found for this account.";
          }
          return JSON.stringify(transactions, null, 2);
        }

        case "get_operations": {
          const operations = await getOperationHistory(
            input.publicKey,
            config,
            input.limit ?? 10,
            input.order ?? "desc"
          );
          if (operations.length === 0) {
            return "No operations found for this account.";
          }
          return JSON.stringify(operations, null, 2);
        }

        case "fund_testnet": {
          if (network !== "testnet") {
            throw new Error(
              "Friendbot funding is only available on testnet. " +
              "Set network to 'testnet' to use this action."
            );
          }
          const result = await fundTestnetAccount(input.publicKey);
          return JSON.stringify(result, null, 2);
        }

        default:
          throw new Error(`Unsupported action: ${input.action}`);
      }
    } catch (error: any) {
      throw new Error(
        `Account tool error (${input.action}): ${error.message}`
      );
    }
  },
});
