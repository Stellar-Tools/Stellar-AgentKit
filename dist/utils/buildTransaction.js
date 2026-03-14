"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTransaction = buildTransaction;
exports.buildTransactionFromXDR = buildTransactionFromXDR;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
/**
 * Unified transaction builder for Stellar operations
 *
 * This function provides a single entry point for building transactions across
 * different operation types (swap, LP, bridge), normalizing fee, timeout, and memo logic.
 *
 * @param operationType - The type of operation: "swap" | "lp" | "bridge"
 * @param sourceAccount - The source account for the transaction
 * @param sorobanOperation - Parameters for the Soroban contract operation
 * @param config - Optional configuration for fee, timeout, and memo
 * @returns A built transaction ready for simulation or signing
 */
function buildTransaction(operationType, sourceAccount, sorobanOperation, config = {}) {
    // Normalize configuration with sensible defaults per operation type
    const fee = config.fee || stellar_sdk_1.BASE_FEE;
    const timeout = config.timeout !== undefined ? config.timeout : getDefaultTimeout(operationType);
    const memo = config.memo;
    // Build transaction parameters
    const networkPassphrase = stellar_sdk_1.Networks.TESTNET;
    const memoValue = memo ? stellar_sdk_1.Memo.text(memo) : undefined;
    const params = {
        fee,
        networkPassphrase,
        memo: memoValue,
    };
    // Build the transaction
    const builder = new stellar_sdk_1.TransactionBuilder(sourceAccount, params);
    // Add the Soroban contract operation
    if (sorobanOperation.args) {
        builder.addOperation(sorobanOperation.contract.call(sorobanOperation.functionName, ...sorobanOperation.args));
    }
    else {
        builder.addOperation(sorobanOperation.contract.call(sorobanOperation.functionName));
    }
    // Set timeout
    builder.setTimeout(timeout);
    // Build and return the transaction
    const transaction = builder.build();
    return transaction;
}
/**
 * Build a transaction from XDR (used for bridge operations with external SDKs)
 *
 * This function is used when external SDKs (like AllbridgeCoreSdk) provide pre-built
 * XDR transactions. It reconstructs the transaction from XDR and applies any additional
 * configuration like memos.
 *
 * @param operationType - The type of operation: "swap" | "lp" | "bridge" | "stake"
 * @param xdrTx - The XDR transaction string
 * @param networkPassphrase - The network passphrase (e.g., Networks.TESTNET)
 * @param config - Optional configuration for memo (fee and timeout are already in XDR)
 * @returns A transaction object reconstructed from XDR
 */
function buildTransactionFromXDR(operationType, xdrTx, networkPassphrase, config = {}) {
    // Reconstruct the transaction from XDR
    const transaction = stellar_sdk_1.TransactionBuilder.fromXDR(xdrTx, networkPassphrase);
    // Note: Fee and timeout are already set in the XDR by external SDKs
    // We only apply memo if provided and not already in the transaction
    if (config.memo) {
        transaction.memo = stellar_sdk_1.Memo.text(config.memo);
    }
    return transaction;
}
/**
 * Get the default timeout for a given operation type
 *
 * Different operations may have different timeout requirements:
 * - swap: 300 seconds (5 minutes)
 * - lp (LP operations): 300 seconds (5 minutes)
 * - bridge: 300 seconds (5 minutes)
 *
 * @param operationType - The type of operation
 * @returns The timeout in seconds
 */
function getDefaultTimeout(operationType) {
    switch (operationType) {
        case "swap":
            return 300;
        case "lp":
            return 300;
        case "bridge":
            return 300;
        case "stake":
            return 300;
        default:
            const _exhaustive = operationType;
            return _exhaustive;
    }
}
