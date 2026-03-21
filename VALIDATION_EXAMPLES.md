/**
 * VALIDATION & ERROR HANDLING INTEGRATION EXAMPLES
 * 
 * This file demonstrates how to use the new error handling and validation framework
 * introduced in this PR.
 */

/**
 * EXAMPLE 1: Basic Agent Usage with Built-in Validation
 * 
 * The new AgentClient automatically validates all inputs and provides
 * meaningful error messages when something goes wrong.
 */
export async function example1_basicUsage() {
  // Import the enhanced agent
  import { AgentClient } from "../src/agent-enhanced";

  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY,
    validateInput: true, // Enable built-in validation (default)
    autoRetry: true,     // Enable automatic retries (default)
  });

  try {
    // This will validate all parameters automatically
    await agent.swap({
      to: "GDZST3XVCDTUJ76ZAV2HA72KYPJMFSND4XNFIXRN7GPYABKK7FEZWWH",
      buyA: true,
      out: "100",
      inMax: "110",
    });
  } catch (error) {
    // All errors are AgentKitError or subclasses
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

/**
 * EXAMPLE 2: Using Validators Directly
 * 
 * You can use validators independently for custom validation logic.
 */
export async function example2_directValidation() {
  import { validateStellarAddress, validateAmount } from "../src/validation";
  import { InvalidAddressError, InvalidAmountError } from "../src/errors";

  // Validate an address
  try {
    const address = validateStellarAddress("GDZST3XVCDTUJ76ZAV2HA72KYPJMFSND4XNFIXRN7GPYABKK7FEZWWH");
    console.log("Valid address:", address);
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      console.error("Invalid Stellar address:", error.message);
      console.error("Suggestion:", error.suggestion);
    }
  }

  // Validate an amount with constraints
  try {
    const amount = validateAmount("150.50", {
      minAmount: 10,
      maxAmount: 1000,
      decimals: 2, // Max 2 decimal places
    });
    console.log("Valid amount:", amount);
  } catch (error) {
    if (error instanceof InvalidAmountError) {
      console.error("Invalid amount:", error.message);
      console.error("Context:", error.context);
    }
  }
}

/**
 * EXAMPLE 3: Error Recovery with Retry Logic
 * 
 * Use the new error handling utilities for robust transaction handling.
 */
export async function example3_errorRecovery() {
  import { retryWithBackoff, isRetriable } from "../src/errors/handlers";
  import { ensureAgentKitError } from "../src/errors";

  // Retry a potentially flaky operation
  try {
    const result = await retryWithBackoff(
      async () => {
        // Some operation that might fail
        return await fetch("https://api.example.com/data").then((r) => r.json());
      },
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        shouldRetry: (error, attempt) => {
          // Only retry on certain conditions
          return attempt < 3 && isRetriable(error);
        },
      }
    );
    console.log("Operation succeeded:", result);
  } catch (error) {
    const agentKitError = ensureAgentKitError(error);
    console.error("Operation failed after retries:", agentKitError.getFormattedMessage());
  }
}

/**
 * EXAMPLE 4: Custom Error Handling
 * 
 * Create custom error types for domain-specific errors.
 */
export async function example4_customErrors() {
  import { AgentKitError } from "../src/errors";

  class InsufficientFundsError extends AgentKitError {
    constructor(available: string, required: string) {
      super(
        `Insufficient funds: have ${available}, need ${required}`,
        "INSUFFICIENT_FUNDS",
        { available, required },
        "Check your account balance and try reducing the amount."
      );
      Object.setPrototypeOf(this, InsufficientFundsError.prototype);
    }
  }

  // Use your custom error
  try {
    throw new InsufficientFundsError("50", "100");
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      console.error(error.getFormattedMessage());
    }
  }
}

/**
 * EXAMPLE 5: Safe Error Handling Without Exceptions
 * 
 * Use Result types for functional error handling.
 */
export async function example5_resultTypes() {
  import { tryAsync, Result } from "../src/errors/handlers";
  import { validateStellarAddress } from "../src/validation";

  // This returns Result, not throws
  const result = await tryAsync(async () => {
    const address = validateStellarAddress("GDZST3XVCDTUJ76ZAV2HA72KYPJMFSND4XNFIXRN7GPYABKK7FEZWWH");
    return { success: true, address };
  });

  if (result.success) {
    console.log("Success:", result.data);
  } else {
    console.error("Error:", result.error.message);
    console.error("Code:", result.error.code);
  }
}

/**
 * EXAMPLE 6: Chaining Multiple Operations
 * 
 * Execute multiple operations with controlled error handling.
 */
export async function example6_chainOperations() {
  import { chainOperations } from "../src/errors/handlers";
  import { AgentClient } from "../src/agent-enhanced";

  const agent = new AgentClient({
    network: "testnet",
  });

  const results = await chainOperations(
    [
      () => agent.lp.getReserves(),
      () => agent.lp.getShareId(),
      () => agent.swap({
        to: "GDZST3XVCDTUJ76ZAV2HA72KYPJMFSND4XNFIXRN7GPYABKK7FEZWWH",
        buyA: true,
        out: "100",
        inMax: "110",
      }),
    ],
    true // Stop on first error
  );

  console.log(`Succeeded: ${results.succeeded}, Failed: ${results.failed}`);
  results.results.forEach((r, i) => {
    if (r instanceof Error) {
      console.error(`Operation ${i} failed:`, r.message);
    } else {
      console.log(`Operation ${i} succeeded`);
    }
  });
}

/**
 * EXAMPLE 7: Formatted Error Messages for Users
 * 
 * Display user-friendly error messages with suggestions.
 */
export async function example7_userFriendlyErrors() {
  import { AgentClient } from "../src/agent-enhanced";
  import { isAgentKitError } from "../src/errors";

  const agent = new AgentClient({
    network: "testnet",
  });

  try {
    await agent.swap({
      to: "invalid-address", // This will fail validation
      buyA: true,
      out: "100",
      inMax: "110",
    });
  } catch (error) {
    if (isAgentKitError(error)) {
      // Display to user in UI or CLI
      console.log("═".repeat(60));
      console.log(error.getFormattedMessage());
      console.log("═".repeat(60));
      // Output:
      // InvalidAddressError [INVALID_ADDRESS_ERROR]
      // Invalid Stellar address: "invalid-ad..."
      //
      // Context:
      //   expectedType: any
      //
      // Suggestion: Ensure the address is a valid Stellar public key...
    }
  }
}

/**
 * EXAMPLE 8: Integration with LangChain Tools
 * 
 * The validation framework works seamlessly with existing LangChain tools.
 */
export async function example8_langchainIntegration() {
  import { DynamicStructuredTool } from "@langchain/core/tools";
  import { z } from "zod";
  import { validateStellarAddress, validateAmount } from "../src/validation";
  import { handleError } from "../src/errors/handlers";

  // Create a tool that uses validation
  const mySwapTool = new DynamicStructuredTool({
    name: "my_swap_tool",
    description: "Perform a token swap with full validation",
    schema: z.object({
      to: z.string().describe("Recipient address"),
      amount: z.string().describe("Amount to swap"),
    }),
    func: async ({ to, amount }) => {
      return await handleError(async () => {
        const validAddress = validateStellarAddress(to);
        const validAmount = validateAmount(amount);

        // Perform swap...
        return `Swap successful: ${validAmount} to ${validAddress}`;
      });
    },
  });

  // Use the tool with an LLM...
  console.log("Tool created:", mySwapTool.name);
}

/**
 * EXAMPLE 9: Migration Guide - Updating Existing Code
 * 
 * How to update existing code to use the new validation framework.
 */
export function example9_migrationGuide() {
  // BEFORE: Manual validation
  // ────────────────────────────
  // function oldSwap(params: any) {
  //   if (!params.to) throw new Error("Missing 'to'");
  //   if (!params.to.startsWith('G')) throw new Error("Invalid address");
  //   if (!params.out || isNaN(Number(params.out))) throw new Error("Invalid out");
  //   // ... rest of function
  // }

  // AFTER: Using validation framework
  // ──────────────────────────────────
  // async function newSwap(params: any) {
  //   const validated = validateSwapParams(params); // Single call
  //   // All parameters are now validated, typed, and safe
  //   await contractSwap(validated.to, validated.buyA, validated.out, validated.inMax);
  // }

  console.log("Migration guide shown in comments above");
}

/**
 * EXAMPLE 10: Testing with Validation
 * 
 * Unit testing becomes easier with proper error types.
 */
export async function example10_testing() {
  import { validateStellarAddress } from "../src/validation";
  import { InvalidAddressError } from "../src/errors";

  // Test valid address
  const validAddress = "GDZST3XVCDTUJ76ZAV2HA72KYPJMFSND4XNFIXRN7GPYABKK7FEZWWH";
  try {
    const result = validateStellarAddress(validAddress);
    console.assert(result === validAddress, "Address validation failed");
  } catch (e) {
    throw new Error("Valid address was rejected");
  }

  // Test invalid address
  try {
    validateStellarAddress("invalid");
    throw new Error("Invalid address was accepted");
  } catch (error) {
    console.assert(error instanceof InvalidAddressError, "Wrong error type");
  }

  console.log("Tests passed!");
}

/*
 * ============================================================================
 * SUMMARY OF IMPROVEMENTS
 * ============================================================================
 *
 * 1. COMPREHENSIVE ERROR HANDLING
 *    - 8+ custom error types for different failure scenarios
 *    - Structured error context and recovery suggestions
 *    - Formatted error messages for end users
 *
 * 2. INPUT VALIDATION
 *    - Reusable validators for all operation parameters
 *    - Chainable, composable validation functions
 *    - Clear error messages with context
 *
 * 3. ROBUSTNESS
 *    - Automatic retry logic with exponential backoff
 *    - Error recovery utilities
 *    - Result types for exception-free error handling
 *
 * 4. DEVELOPER EXPERIENCE
 *    - Type-safe validation with TypeScript
 *    - Meaningful error codes for programmatic handling
 *    - Suggestions for fixing errors
 *
 * 5. TESTING
 *    - Easy to test error conditions
 *    - Type-safe error assertions
 *    - Clear error context for debugging
 *
 * ============================================================================
 */
