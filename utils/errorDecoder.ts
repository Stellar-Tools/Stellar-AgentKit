/**
 * Utility to decode Stellar and Soroban error messages into human-readable strings.
 */

export interface StellarError {
  response?: {
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
      detail?: string;
    };
    status?: number;
  };
  message?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  // Transaction level
  tx_failed: "The transaction failed to execute.",
  tx_bad_seq: "Transaction sequence number is incorrect. Please try again.",
  tx_too_late: "The transaction has expired.",
  tx_too_early: "The transaction was submitted too early.",
  tx_insufficient_fee: "The transaction fee was too low.",
  tx_missing_operation: "The transaction has no operations.",
  tx_bad_auth: "Transaction has too few or invalid signatures.",
  tx_no_source_account: "The source account was not found.",

  // Operation level
  op_underfunded: "Account has insufficient funds for this operation.",
  op_low_reserve: "Account does not have enough balance to meet the minimum reserve requirement.",
  op_no_trust: "The account is missing a trustline for the required asset.",
  op_not_authorized: "The account is not authorized to hold this asset.",
  op_line_full: "The trustline limit for this asset has been reached.",
  op_no_destination: "The destination account does not exist.",
  op_no_issuer: "The asset issuer does not exist.",
  op_src_not_authorized: "The source account is not authorized to send this asset.",
  op_src_no_trust: "The source account is missing a trustline for the asset.",
  op_too_many_subentries: "The account has reached the maximum number of subentries (trustlines, offers, etc.).",
  op_cross_self: "Cannot trade with oneself.",
  op_bad_auth: "Operation has invalid signatures.",
  op_immutable_set: "The account is immutable and its options cannot be changed.",
  
  // DEX specific
  op_under_dest_min: "The swap could not be completed at the requested price (slippage too high).",
  op_over_source_max: "The swap would require more source assets than the specified maximum.",
  op_no_path: "No viable path found for this swap.",
  
  // Soroban/Smart Contract
  HostError: "A smart contract execution error occurred.",
  ContractError: "The smart contract returned an error.",
};

/**
 * Decodes a Stellar/Horizon/Soroban error into a human-readable message.
 */
export function decodeStellarError(error: any): string {
  if (!error) return "Unknown error occurred.";

  // Handle Horizon errors
  const resultCodes = error.response?.data?.extras?.result_codes;
  if (resultCodes) {
    const messages: string[] = [];

    // Check transaction-level error
    if (resultCodes.transaction && ERROR_MESSAGES[resultCodes.transaction]) {
      messages.push(ERROR_MESSAGES[resultCodes.transaction]);
    }

    // Check operation-level errors
    if (resultCodes.operations && Array.isArray(resultCodes.operations)) {
      resultCodes.operations.forEach((opCode: string) => {
        if (opCode !== "op_success" && ERROR_MESSAGES[opCode]) {
          messages.push(ERROR_MESSAGES[opCode]);
        } else if (opCode !== "op_success") {
          messages.push(`Operation failed: ${opCode}`);
        }
      });
    }

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  // Handle Horizon detail message
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }

  // Handle Soroban RPC errors
  if (error.status === "FAILED") {
    return "The smart contract transaction failed.";
  }

  // Handle general Error objects
  if (error.message) {
    // Try to extract known error codes from message strings
    for (const [code, msg] of Object.entries(ERROR_MESSAGES)) {
      if (error.message.includes(code)) {
        return `${msg} (${code})`;
      }
    }
    return error.message;
  }

  return String(error);
}
