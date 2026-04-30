import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { listClaimableBalances, claimBalance } from "../lib/claimF";

export const StellarClaimBalanceTool = new DynamicStructuredTool({
  name: "stellar_claim_balance_tool",
  description:
    "Discover and claim pending assets (claimable balances) on the Stellar network for the user account. Returns an unsigned XDR for claim actions.",
  schema: z.object({
    action: z.enum(["list", "claim"]),
    balanceId: z.string().optional(), // Optional: if provided, claims a specific ID; otherwise claims all.
  }),
  func: async ({ action, balanceId }: { action: "list" | "claim"; balanceId?: string }) => {
    const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;

    if (!STELLAR_PUBLIC_KEY) {
      throw new Error("Missing STELLAR_PUBLIC_KEY environment variable");
    }

    try {
      switch (action) {
        case "list": {
          const balances = await listClaimableBalances(STELLAR_PUBLIC_KEY);
          if (balances.length === 0) return "No pending claimable balances found.";
          return JSON.stringify(balances, null, 2);
        }

        case "claim": {
          const tx = await claimBalance(STELLAR_PUBLIC_KEY, balanceId);
          // In a real agent scenario, this XDR would be signed and submitted.
          return `Claim transaction built successfully. XDR: ${tx.toXDR()}`;
        }

        default:
          throw new Error("Unsupported action");
      }
    } catch (error: any) {
      console.error("StellarClaimBalanceTool error:", error.message);
      throw new Error(`Failed to execute ${action}: ${error.message}`);
    }
  },
});
