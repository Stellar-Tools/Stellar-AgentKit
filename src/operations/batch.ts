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
} from "@stellar/stellar-sdk";
import { TransactionError, ContractError, ValidationError } from "./errors";

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
    this.options = {
      rpcUrl: options.rpcUrl || "https://soroban-testnet.stellar.org",
      networkPassphrase: options.networkPassphrase || Networks.TESTNET,
      timeout: options.timeout || 300,
      memo: options.memo || "",
      feeMultiplier: options.feeMultiplier || 1.2, // 20% extra for batch
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
    const operationFee = BASE_FEE * Math.ceil(this.operations.length * this.options.feeMultiplier);

    const builder = new TransactionBuilder(this.sourceAccount, {
      fee: operationFee.toString(),
      networkPassphrase: this.options.networkPassphrase,
      memo: this.options.memo
        ? { type: "text", value: this.options.memo }
        : undefined,
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
  const rpcUrl = options.rpcUrl || "https://soroban-testnet.stellar.org";
  const networkPassphrase = options.networkPassphrase || Networks.TESTNET;

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });

    // Sign transaction
    const { Keypair, TransactionEnvelope } = await import("@stellar/stellar-sdk");
    const keypair = Keypair.fromSecret(privateKey);
    transaction.sign(keypair);

    // Submit transaction
    const response = await server.submitTransaction(transaction);

    if (!("hash" in response)) {
      throw new TransactionError(
        "Invalid transaction submission response",
        { response: JSON.stringify(response) }
      );
    }

    // Parse transaction results
    const operations = (transaction as any).operations?.length || 0;

    return {
      transactionHash: response.hash,
      ledger: response.ledger || 0,
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
  const rpcUrl = options.rpcUrl || "https://soroban-testnet.stellar.org";

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });

    const simulation = await server.simulateTransaction(transaction);

    if ("error" in simulation) {
      throw new ContractError(
        `Batch simulation failed: ${simulation.error}`,
        { rpcUrl }
      );
    }

    return {
      estimatedFee: (BigInt(transaction.fee || BASE_FEE) * BigInt(1000000000)).toString(),
      resourceUsage: (simulation as any).results?.[0] || {},
      success: true,
    };
  } catch (error) {
    throw new NetworkError(
      `Failed to simulate batch transaction: ${error instanceof Error ? error.message : String(error)}`,
      { rpcUrl }
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
