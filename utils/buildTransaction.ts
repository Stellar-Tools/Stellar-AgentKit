import {
  Contract,
  FeeBumpTransaction,
  TransactionBuilder,
  Account,
  Asset,
  BASE_FEE,
  Networks,
  Transaction,
  Memo,
  Operation,
} from "@stellar/stellar-sdk";

/**
 * Configuration for transaction building
 */
interface BuildTransactionConfig {
  fee?: string;
  timeout?: number;
  memo?: string;
  /**
   * Network passphrase for the transaction envelope.
   * Required — must be Networks.TESTNET or Networks.PUBLIC.
   * Providing the wrong value causes the Soroban RPC to reject
   * the transaction immediately (signature mismatch on the envelope).
   */
  networkPassphrase: string;
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

interface PathPaymentOperationParams {
  mode: "strict-send" | "strict-receive";
  sendAsset: Asset;
  destAsset: Asset;
  sendAmount: string;
  destAmount: string;
  destination: string;
  path: Asset[];
  sendMax?: string;
  destMin?: string;
}

/**
 * Unified transaction builder for Stellar operations.
 *
 * This function provides a single entry point for building transactions across
 * different operation types (swap, LP, bridge, stake), normalising fee,
 * timeout, memo, and — critically — the network passphrase.
 *
 * @param operationType    - The type of operation: "swap" | "lp" | "bridge" | "stake"
 * @param sourceAccount    - The source account for the transaction
 * @param sorobanOperation - Parameters for the Soroban contract operation
 * @param config           - Configuration; networkPassphrase is required
 * @returns A built transaction ready for simulation or signing
 *
 * @example
 * // Mainnet usage — always pass the correct passphrase:
 * const tx = buildTransaction("lp", account, op, {
 *   networkPassphrase: Networks.PUBLIC,
 * });
 */
export function buildTransaction(
  operationType: OperationType,
  sourceAccount: Account,
  sorobanOperation: SorobanOperationParams,
  config: BuildTransactionConfig
): Transaction {
  const fee               = config.fee ?? BASE_FEE;
  const timeout           = config.timeout !== undefined ? config.timeout : getDefaultTimeout(operationType);
  const memo              = config.memo;
  const networkPassphrase = config.networkPassphrase;
  const memoValue         = memo ? Memo.text(memo) : undefined;

  const builder = new TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase,
    memo: memoValue,
  });

  if (sorobanOperation.args && sorobanOperation.args.length > 0) {
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

  builder.setTimeout(timeout);
  return builder.build();
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
  _operationType: OperationType,
  xdrTx: string,
  networkPassphrase: string,
  config: Pick<BuildTransactionConfig, "memo"> = {}
): Transaction | FeeBumpTransaction {
  const transaction = TransactionBuilder.fromXDR(xdrTx, networkPassphrase);

  // Only mutate memo on a regular Transaction — FeeBumpTransaction wraps an
  // inner transaction and does not expose .memo directly, so mutating it is
  // either a silent no-op or a runtime error depending on SDK version.
  if (config.memo && transaction instanceof Transaction) {
    transaction.memo = Memo.text(config.memo);
  }

  return transaction;
}

export function buildPathPaymentTransaction(
  sourceAccount: Account,
  operation: PathPaymentOperationParams,
  config: BuildTransactionConfig
): Transaction {
  const fee = config.fee ?? BASE_FEE;
  const timeout = config.timeout !== undefined ? config.timeout : 300;
  const memo = config.memo ? Memo.text(config.memo) : undefined;

  const builder = new TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase: config.networkPassphrase,
    memo,
  });

  if (operation.mode === "strict-send") {
    if (!operation.destMin) {
      throw new Error("destMin is required for strict-send path payments");
    }

    builder.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: operation.sendAsset,
        sendAmount: operation.sendAmount,
        destination: operation.destination,
        destAsset: operation.destAsset,
        destMin: operation.destMin,
        path: operation.path,
      })
    );
  } else {
    if (!operation.sendMax) {
      throw new Error("sendMax is required for strict-receive path payments");
    }

    builder.addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: operation.sendAsset,
        sendMax: operation.sendMax,
        destination: operation.destination,
        destAsset: operation.destAsset,
        destAmount: operation.destAmount,
        path: operation.path,
      })
    );
  }

  builder.setTimeout(timeout);
  return builder.build();
}

/**
 * Get the default timeout for a given operation type
 *
 * Different operations may have different timeout requirements:
 * - swap: 300 seconds (5 minutes)
 * - lp (LP operations): 300 seconds (5 minutes)
 * - bridge: 300 seconds (5 minutes)
 * - stake: 300 seconds (5 minutes)
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
      throw new Error(`Unhandled operation type: ${_exhaustive}`);
  }
}

export type { OperationType, BuildTransactionConfig, SorobanOperationParams };
