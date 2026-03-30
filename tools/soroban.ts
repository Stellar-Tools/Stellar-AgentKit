import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SorobanClient } from "../lib/soroban";
import { Networks, nativeToScVal } from "@stellar/stellar-sdk";

const rpcUrl = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

export const stellarGenericSorobanCallTool = new DynamicStructuredTool({
  name: "stellar_generic_soroban_call",
  description: "Call any Soroban smart contract function. Use this for protocols not explicitly supported by other tools.",
  schema: z.object({
    caller: z.string().describe("The public key of the account making the call"),
    contractId: z.string().describe("The contract ID (address) to call"),
    functionName: z.string().describe("The name of the function to call"),
    args: z.array(z.any()).optional().describe("List of arguments for the function call"),
    operationType: z.enum(["lp", "stake", "other"]).default("other").describe("The type of operation for building the transaction"),
  }),
  func: async ({ caller, contractId, functionName, args, operationType }) => {
    try {
      const client = new SorobanClient({
        rpcUrl,
        contractAddress: contractId,
        networkPassphrase,
      });

      // Simple conversion of basic types to ScVal if needed
      // Note: For complex types, the agent should ideally provide ScXDR or we need a better mapper
      const convertedArgs = args?.map(arg => {
        if (typeof arg === 'string' && arg.match(/^[CG][A-Z0-9]{55}$/)) {
            // Likely an address, but nativeToScVal needs explicit type for clarity in some cases
            return arg; 
        }
        return arg;
      });

      const result = await client.call(caller, functionName, convertedArgs, operationType as any);
      return JSON.stringify({
        status: "success",
        result,
        message: `Successfully called ${functionName} on contract ${contractId}`
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message
      });
    }
  },
});
