/**
 * Batch Transaction Operations for Stellar AgentKit
 * 
 * Execute multiple contract operations in a single transaction.
 * Improves gas efficiency and atomic execution.
 * 
 * Example: Deposit to LP + Swap + Claim rewards in one transaction
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Networks,
  rpc,
  Memo,
  Keypair,
} from "@stellar/stellar-sdk";
import { TransactionError, ContractError, ValidationError } from "../errors";

function getDefaultRpcUrl(networkPassphrase: string): string {
  return networkPassphrase === Networks.PUBLIC
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org";
}

function parsePositiveMultiplier(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new ValidationError(
      `Invalid feeMultiplier: ${resolved}`,
      { feeMultiplier: resolved },
      "feeMultiplier must be a finite positive number"
    );
  }
  return resolved;
}

export interface BatchOperation {
  contract: Contract;
  functionName: string;
  args: any[];
  description?: string;
}

export interface BatchTransactionOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
  timeout?: number;
  memo?: string;
  feeMultiplier?: number; // Multiplier for batch fee (operations cost more together)
}

export interface BatchExecutionResult {
  transactionHash: string;
  ledger: number;
  operations: number;
  status: "success" | "partial" | "failed";
  results: Array<{
    operation: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  totalFee: string;
}

/**
 * Batch transaction builder
 * 
 * Combines multiple Soroban contract operations into a single transaction
 * for atomic execution and gas efficiency.
 */
export class BatchTransactionBuilder {
  private operations: BatchOperation[] = [];
  private readonly maxOperations = 20; // Soroban limit
  private readonly sourceAccount: Account;
  private readonly options: Required<BatchTransactionOptions>;

  constructor(
    sourceAccount: Account,
    options: BatchTransactionOptions = {}
  ) {
    this.sourceAccount = sourceAccount;
    const networkPassphrase = options.networkPassphrase || Networks.TESTNET;

    this.options = {
      rpcUrl: options.rpcUrl || getDefaultRpcUrl(networkPassphrase),
      networkPassphrase,
      timeout: options.timeout || 300,
      memo: options.memo || "",
      feeMultiplier: parsePositiveMultiplier(options.feeMultiplier, 1.2), // 20% extra for batch
    };
  }

  /**
   * Add an operation to the batch
   */
  addOperation(
    contract: Contract,
    functionName: string,
    args: any[],
    description?: string
  ): this {
    if (this.operations.length >= this.maxOperations) {
      throw new ValidationError(
        `Maximum batch operations exceeded (${this.maxOperations})`,
        { current: this.operations.length, max: this.maxOperations }
      );
    }

    this.operations.push({
      contract,
      functionName,
      args,
      description,
    });

    return this; // For chaining
  }

  /**
   * Add swap operation
   */
  addSwap(
    contract: Contract,
    to: string,
    buyA: boolean,
    out: string,
    inMax: string
  ): this {
    return this.addOperation(
      contract,
      "swap",
      [to, buyA, out, inMax],
      `Swap ${buyA ? "to A" : "to B"}: out=${out}`
    );
  }

  /**
   * Add LP deposit operation
   */
  addDeposit(
    contract: Contract,
    to: string,
    desiredA: string,
    minA: string,
    desiredB: string,
    minB: string
  ): this {
    return this.addOperation(
      contract,
      "deposit",
      [to, desiredA, minA, desiredB, minB],
      `Deposit: A=${desiredA}, B=${desiredB}`
    );
  }

  /**
   * Add LP withdrawal operation
   */
  addWithdraw(
    contract: Contract,
    to: string,
    shareAmount: string,
    minA: string,
    minB: string
  ): this {
    return this.addOperation(
      contract,
      "withdraw",
      [to, shareAmount, minA, minB],
      `Withdraw: shares=${shareAmount}`
    );
  }

  /**
   * Build the batch transaction (unsigned)
   */
  build(): any {
    if (this.operations.length === 0) {
      throw new ValidationError(
        "No operations in batch",
        {},
        "Add at least one operation before building"
      );
    }

    // Calculate fee: base + (count * operation fee) with multiplier
    const baseFeeNum = parseInt(BASE_FEE, 10);
    const operationFee = baseFeeNum * Math.ceil(this.operations.length * this.options.feeMultiplier);

    const memoObj = this.options.memo
      ? Memo.text(this.options.memo)
      : undefined;

    const builder = new TransactionBuilder(this.sourceAccount, {
      fee: operationFee.toString(),
      networkPassphrase: this.options.networkPassphrase,
      memo: memoObj,
    });

    // Add all operations
    for (const op of this.operations) {
      builder.addOperation(
        op.contract.call(op.functionName, ...op.args)
      );
    }

    builder.setTimeout(this.options.timeout);

    return builder.build();
  }

  /**
   * Get operation count
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Get operation descriptions
   */
  getOperationSummary(): string[] {
    return this.operations.map(
      (op) => op.description || `${op.functionName}(...)`
    );
  }

  /**
   * Clear all operations
   */
  clear(): this {
    this.operations = [];
    return this;
  }
}

/**
 * Execute and monitor batch transaction
 */
export async function executeBatchTransaction(
  transaction: any,
  privateKey: string,
  options: BatchTransactionOptions = {}
): Promise<BatchExecutionResult> {
  const networkPassphrase = options.networkPassphrase || Networks.TESTNET;
  const rpcUrl = options.rpcUrl || getDefaultRpcUrl(networkPassphrase);
  const timeoutSeconds = options.timeout ?? 300;

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });

    // Sign transaction
    const keypair = Keypair.fromSecret(privateKey);
    transaction.sign(keypair);

    // Submit transaction using sendTransaction (if available) or throw
    let response: any;
    if ('sendTransaction' in server) {
      response = await (server as any).sendTransaction(transaction);
    } else if ('submitTransaction' in server) {
      response = await (server as any).submitTransaction(transaction);
    } else {
      throw new TransactionError(
        "RPC server does not support transaction submission",
        { rpcUrl }
      );
    }

    if (!("hash" in response)) {
      throw new TransactionError(
        "Invalid transaction submission response",
        { response: JSON.stringify(response) }
      );
    }

    if (response.status === "ERROR") {
      throw new TransactionError(
        "Transaction submission failed",
        { response: JSON.stringify(response), rpcUrl }
      );
    }

    // Confirm final transaction outcome from RPC instead of assuming success on submission.
    let finalTx: any = null;
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      finalTx = await server.getTransaction(response.hash);
      if (finalTx && (finalTx.status === "SUCCESS" || finalTx.status === "FAILED")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!finalTx || finalTx.status !== "SUCCESS") {
      throw new TransactionError(
        "Batch transaction was submitted but not confirmed successfully",
        { hash: response.hash, finalStatus: finalTx?.status, rpcUrl }
      );
    }

    // Parse transaction results
    const operations = (transaction as any).operations?.length || 0;

    return {
      transactionHash: response.hash,
      ledger: Number(finalTx.ledger) || Number(response.ledger) || 0,
      operations,
      status: "success",
      results: Array(operations)
        .fill(null)
        .map((_, i) => ({
          operation: `Operation ${i + 1}`,
          success: true,
        })),
      totalFee: transaction.fee?.toString() || BASE_FEE.toString(),
    };
  } catch (error) {
    throw new TransactionError(
      `Batch transaction execution failed: ${error instanceof Error ? error.message : String(error)}`,
      { rpcUrl, operationCount: (transaction as any).operations?.length },
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Simulate batch transaction to estimate fees
 */
export async function simulateBatchTransaction(
  transaction: any,
  options: BatchTransactionOptions = {}
): Promise<{
  estimatedFee: string;
  resourceUsage: Record<string, any>;
  success: boolean;
}> {
  const networkPassphrase = options.networkPassphrase || Networks.TESTNET;
  const rpcUrl = options.rpcUrl || getDefaultRpcUrl(networkPassphrase);

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });

    const simulation = await server.simulateTransaction(transaction);

    if ("error" in simulation) {
      throw new ContractError(
        `Batch simulation failed: ${simulation.error}`,
        { rpcUrl }
      );
    }

    const txFee = BigInt(transaction.fee || BASE_FEE);
    const resourceFee = (() => {
      const minResourceFee = (simulation as any).minResourceFee;
      if (minResourceFee === undefined || minResourceFee === null) {
        return 0n;
      }
      try {
        return BigInt(String(minResourceFee));
      } catch {
        return 0n;
      }
    })();

    return {
      estimatedFee: (txFee + resourceFee).toString(),
      resourceUsage: (simulation as any).results?.[0] || {},
      success: true,
    };
  } catch (error) {
    throw new TransactionError(
      `Failed to simulate batch transaction: ${error instanceof Error ? error.message : String(error)}`,
      { rpcUrl },
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Helper to create pre-configured batch builder
 */
export function createBatchBuilder(
  sourceAccount: Account,
  network: "testnet" | "mainnet" = "testnet"
): BatchTransactionBuilder {
  return new BatchTransactionBuilder(sourceAccount, {
    networkPassphrase: network === "testnet" ? Networks.TESTNET : Networks.PUBLIC,
  });
}
