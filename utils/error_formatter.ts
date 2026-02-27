/**
 * Utility to format complex Stellar/Horizon errors into user-friendly messages.
 */
export function formatStellarError(error: any): string {
    const message = error instanceof Error ? error.message : String(error);
    const data = error?.response?.data;
    const extras = data?.extras;
  
    // 1. Check for Horizon's result_codes (most specific)
    if (extras?.result_codes?.operations) {
      const opResult = extras.result_codes.operations[0];
      switch (opResult) {
        case "op_no_trust":
          return "Error: The recipient or sender does not have a trustline for this asset. Please use 'ensureTrustline' first.";
        case "op_low_reserve":
          return "Error: Account bance is too low to cover the minimum reserve requirement. Add more XLM.";
        case "op_underfunded":
          return "Error: Insufficient funds to complete this transaction.";
        case "op_no_destination":
          return "Error: The destination account does not exist. It must be created with a createAccount operation first.";
        case "op_cross_self":
          return "Error: You cannot swap or trade with yourself.";
      }
    }
  
    // 2. Check for common problem titles
    if (data?.title === "Transaction Overshot") {
        return "Error: Transaction took too long to process (Timeout). The retry mechanism will handle this.";
    }
  
    if (data?.title === "Rate Limit Exceeded") {
        return "Error: Too many requests sent to the network. Please wait a moment.";
    }
  
    // 3. Fallback to common message patterns
    if (message.includes("404")) return "Error: Resource not found (404) on the network.";
    if (message.includes("429")) return "Error: Rate limited by the server.";
  
    return `Error: ${data?.detail || message}`;
  }
