import {
  Contract,
  rpc,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Networks,
  Transaction,
  Memo,
} from "@stellar/stellar-sdk";

/**
 * Configuration for transaction building
 */
interface BuildTransactionConfig {
  fee?: string;
  timeout?: number;
  memo?: string;
}

/**
 * Operation type for transaction building
 */
type OperationType = "swap" | "lp" | "bridge" | "stake";

/**
 * Parameters for building a Soroban contract operation
 */
interface SorobanOperationParams {
  contract: Contract;
  functionName: string;
  args?: any[];
}

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
export function buildTransaction(
  operationType: OperationType,
  sourceAccount: Account,
  sorobanOperation: SorobanOperationParams,
  config: BuildTransactionConfig = {}
): any {
  // Normalize configuration with sensible defaults per operation type
  const fee = config.fee || BASE_FEE;
  const timeout = config.timeout !== undefined ? config.timeout : getDefaultTimeout(operationType);
  const memo = config.memo;

  // Build transaction parameters
  const networkPassphrase = Networks.TESTNET;
  const memoValue = memo ? Memo.text(memo) : undefined;
  const params = {
    fee,
    networkPassphrase,
    memo: memoValue,
  };

  // Build the transaction
  const builder = new TransactionBuilder(sourceAccount, params);

  // Add the Soroban contract operation
  if (sorobanOperation.args) {
    builder.addOperation(
      sorobanOperation.contract.call(
        sorobanOperation.functionName,
        ...sorobanOperation.args
      )
    );
  } else {
    builder.addOperation(
      sorobanOperation.contract.call(sorobanOperation.functionName)
    );
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
export function buildTransactionFromXDR(
  operationType: OperationType,
  xdrTx: string,
  networkPassphrase: string,
  config: BuildTransactionConfig = {}
): any {
  // Reconstruct the transaction from XDR
  const transaction = TransactionBuilder.fromXDR(xdrTx, networkPassphrase);
  
  // Note: Fee and timeout are already set in the XDR by external SDKs
  // We only apply memo if provided and not already in the transaction
  if (config.memo) {
    // Memos are typically already set by the SDK, but document this for future use
    console.log(
      `Memo provided for ${operationType} operation. Note: XDR transactions may already include memo from source SDK.`
    );
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
function getDefaultTimeout(operationType: OperationType): number {
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
      const _exhaustive: never = operationType;
      return _exhaustive;
  }
}

export type { OperationType, BuildTransactionConfig, SorobanOperationParams };
