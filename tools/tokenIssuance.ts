import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { launchToken, LaunchTokenParams } from "../lib/tokenIssuance";

// Environment variables for token issuance
const ISSUER_SECRET = process.env.ISSUER_SECRET;
const DISTRIBUTOR_SECRET = process.env.DISTRIBUTOR_SECRET;

if (!ISSUER_SECRET || !DISTRIBUTOR_SECRET) {
  console.warn(
    "⚠️  Token issuance credentials not configured.\n" +
    "Set ISSUER_SECRET and DISTRIBUTOR_SECRET in .env to use stellarLaunchTokenTool."
  );
}

export const stellarLaunchTokenTool = new DynamicStructuredTool({
  name: "stellar_launch_token",
  description:
    "Launch a new custom Stellar asset (token). Creates trustline, mints initial supply, and optionally locks the issuer to create a fixed-supply token. Requires ISSUER_SECRET and DISTRIBUTOR_SECRET in environment.",
  schema: z.object({
    code: z
      .string()
      .min(1)
      .max(12)
      .describe("Asset code (1-12 alphanumeric characters, e.g., 'MYTOKEN')"),
    initialSupply: z
      .string()
      .describe("Initial token supply as a string (e.g., '1000000')"),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(7)
      .default(7)
      .describe("Decimal precision for the token (0-7, default 7)"),
    lockIssuer: z
      .boolean()
      .default(false)
      .describe(
        "If true, locks the issuer account to prevent further token issuance (creates fixed supply)"
      ),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("Network to launch token on (testnet or mainnet)"),
  }),
  func: async ({
    code,
    initialSupply,
    decimals,
    lockIssuer,
    network,
  }: {
    code: string;
    initialSupply: string;
    decimals: number;
    lockIssuer: boolean;
    network: "testnet" | "mainnet";
  }) => {
    try {
      // Validate environment variables
      if (!ISSUER_SECRET || !DISTRIBUTOR_SECRET) {
        throw new Error(
          "Token issuance not configured: Missing ISSUER_SECRET or DISTRIBUTOR_SECRET in environment variables."
        );
      }

      // Mainnet safety check
      if (network === "mainnet") {
        if (process.env.ALLOW_MAINNET_TOKEN_ISSUANCE !== "true") {
          throw new Error(
            "Mainnet token issuance is disabled for safety.\n" +
            "To enable, set ALLOW_MAINNET_TOKEN_ISSUANCE=true in your .env file.\n" +
            "⚠️  WARNING: This will create real assets on the Stellar mainnet."
          );
        }
      }

      const params: LaunchTokenParams = {
        code,
        issuerSecret: ISSUER_SECRET,
        distributorSecret: DISTRIBUTOR_SECRET,
        initialSupply,
        decimals,
        lockIssuer,
      };

      const result = await launchToken(params, network);

      // Format success response
      let response = `✅ Token "${result.assetCode}" launched successfully!\n\n`;
      response += `Network: ${result.network}\n`;
      response += `Issuer: ${result.issuerPublicKey}\n`;
      response += `Distributor: ${result.distributorPublicKey}\n`;
      response += `Initial Supply: ${result.initialSupply}\n`;
      response += `Issuer Locked: ${result.issuerLocked ? "Yes (fixed supply)" : "No (can mint more)"}\n\n`;
      response += `Transaction Hashes:\n`;
      response += `  - Trustline: ${result.trustlineHash}\n`;
      response += `  - Mint: ${result.mintHash}\n`;
      if (result.lockHash) {
        response += `  - Lock: ${result.lockHash}\n`;
      }

      return response;
    } catch (error: any) {
      console.error("stellarLaunchTokenTool error:", error.message);
      throw new Error(`Failed to launch token: ${error.message}`);
    }
  },
});
