import { rpc, Networks } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Transaction status types
 */
export enum TransactionStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  NOT_FOUND = "NOT_FOUND",
  TIMEOUT = "TIMEOUT",
}

/**
 * Operation types for transaction tracking
 */
export enum OperationType {
  SWAP = "swap",
  BRIDGE = "bridge",
  LP_DEPOSIT = "lp_deposit",
  LP_WITHDRAW = "lp_withdraw",
  PAYMENT = "payment",
  STAKE = "stake",
}

/**
 * Network types
 */
export type NetworkType = "testnet" | "mainnet";

/**
 * Transaction metadata
 */
export interface TransactionMetadata {
  operationType: OperationType;
  network: NetworkType;
  timestamp: number;
  params?: Record<string, any>;
}

/**
 * Detailed transaction status response
 */
export interface TransactionStatusResponse {
  hash: string;
  status: TransactionStatus;
  network: NetworkType;
  operationType: OperationType;
  ledger?: number;
  createdAt?: string;
  applicationOrder?: number;
  feeBump?: boolean;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  returnValue?: any;
  errorMessage?: string;
  retryCount?: number;
  elapsedTime?: number;
}

/**
 * Configuration for transaction tracking
 */
export interface TransactionTrackerConfig {
  maxRetries?: number;
  retryInterval?: number;
  timeout?: number;
  network?: NetworkType;
  rpcUrl?: string;
}

/**
 * Transaction Tracker Class
 * 
 * Provides comprehensive transaction monitoring and status tracking
 * for all Stellar operations including swap, bridge, LP, and payment operations.
 */
export class TransactionTracker {
  private maxRetries: number;
  private retryInterval: number;
  private timeout: number;
  private network: NetworkType;
  private rpcUrl: string;
  private server: rpc.Server;
  private trackedTransactions: Map<string, TransactionMetadata>;

  constructor(config: TransactionTrackerConfig = {}) {
    this.maxRetries = config.maxRetries || 30;
    this.retryInterval = config.retryInterval || 2000; // 2 seconds
    this.timeout = config.timeout || 60000; // 60 seconds
    this.network = config.network || "testnet";
    
    // Set RPC URL based on network
    if (config.rpcUrl) {
      this.rpcUrl = config.rpcUrl;
    } else {
      this.rpcUrl = this.network === "mainnet" 
        ? process.env.SRB_MAINNET_PROVIDER_URL || "https://soroban.stellar.org"
        : process.env.SRB_PROVIDER_URL || "https://soroban-testnet.stellar.org";
    }

    this.server = new rpc.Server(this.rpcUrl, { allowHttp: true });
    this.trackedTransactions = new Map();
  }

  /**
   * Track a new transaction
   * 
   * @param hash - Transaction hash
   * @param operationType - Type of operation
   * @param params - Optional parameters associated with the transaction
   */
  trackTransaction(
    hash: string,
    operationType: OperationType,
    params?: Record<string, any>
  ): void {
    this.trackedTransactions.set(hash, {
      operationType,
      network: this.network,
      timestamp: Date.now(),
      params,
    });
  }

  /**
   * Get transaction status with detailed information
   * 
   * @param hash - Transaction hash to query
   * @returns Detailed transaction status
   */
  async getTransactionStatus(hash: string): Promise<TransactionStatusResponse> {
    const metadata = this.trackedTransactions.get(hash);
    const operationType = metadata?.operationType || OperationType.PAYMENT;

    try {
      const txResponse = await this.server.getTransaction(hash);

      if (txResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        return {
          hash,
          status: TransactionStatus.NOT_FOUND,
          network: this.network,
          operationType,
          errorMessage: "Transaction not found on the network",
        };
      }

      if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        const response: TransactionStatusResponse = {
          hash,
          status: TransactionStatus.SUCCESS,
          network: this.network,
          operationType,
          ledger: txResponse.ledger,
          createdAt: txResponse.createdAt,
          applicationOrder: txResponse.applicationOrder,
          envelopeXdr: txResponse.envelopeXdr?.toString(),
          resultXdr: txResponse.resultXdr?.toString(),
          resultMetaXdr: txResponse.resultMetaXdr?.toString(),
        };

        // Parse return value if available
        if (txResponse.returnValue) {
          try {
            response.returnValue = this.parseReturnValue(txResponse.returnValue);
          } catch (error) {
            console.warn("Failed to parse return value:", error);
          }
        }

        return response;
      }

      if (txResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
        return {
          hash,
          status: TransactionStatus.FAILED,
          network: this.network,
          operationType,
          ledger: txResponse.ledger,
          createdAt: txResponse.createdAt,
          resultXdr: txResponse.resultXdr?.toString(),
          errorMessage: "Transaction failed on the network",
        };
      }

      return {
        hash,
        status: TransactionStatus.PENDING,
        network: this.network,
        operationType,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        hash,
        status: TransactionStatus.FAILED,
        network: this.network,
        operationType,
        errorMessage: `Failed to query transaction: ${errorMessage}`,
      };
    }
  }

  /**
   * Wait for transaction confirmation with retry logic
   * 
   * @param hash - Transaction hash to monitor
   * @param operationType - Type of operation
   * @returns Final transaction status
   */
  async waitForConfirmation(
    hash: string,
    operationType: OperationType
  ): Promise<TransactionStatusResponse> {
    this.trackTransaction(hash, operationType);
    
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      const elapsedTime = Date.now() - startTime;

      // Check timeout
      if (elapsedTime > this.timeout) {
        return {
          hash,
          status: TransactionStatus.TIMEOUT,
          network: this.network,
          operationType,
          retryCount,
          elapsedTime,
          errorMessage: `Transaction confirmation timeout after ${this.timeout}ms`,
        };
      }

      const status = await this.getTransactionStatus(hash);
      status.retryCount = retryCount;
      status.elapsedTime = elapsedTime;

      // Return if transaction is in final state
      if (
        status.status === TransactionStatus.SUCCESS ||
        status.status === TransactionStatus.FAILED
      ) {
        return status;
      }

      // Wait before next retry
      await this.sleep(this.retryInterval);
      retryCount++;
    }

    // Max retries reached
    return {
      hash,
      status: TransactionStatus.TIMEOUT,
      network: this.network,
      operationType,
      retryCount,
      elapsedTime: Date.now() - startTime,
      errorMessage: `Max retries (${this.maxRetries}) reached without confirmation`,
    };
  }

  /**
   * Monitor multiple transactions simultaneously
   * 
   * @param hashes - Array of transaction hashes to monitor
   * @param operationType - Type of operation
   * @returns Array of transaction statuses
   */
  async monitorTransactions(
    hashes: string[],
    operationType: OperationType
  ): Promise<TransactionStatusResponse[]> {
    const promises = hashes.map((hash) =>
      this.waitForConfirmation(hash, operationType)
    );
    return Promise.all(promises);
  }

  /**
   * Get all tracked transactions
   * 
   * @returns Map of tracked transactions
   */
  getTrackedTransactions(): Map<string, TransactionMetadata> {
    return new Map(this.trackedTransactions);
  }

  /**
   * Clear tracking history
   */
  clearTracking(): void {
    this.trackedTransactions.clear();
  }

  /**
   * Get transaction history for a specific operation type
   * 
   * @param operationType - Type of operation to filter
   * @returns Array of transaction hashes and metadata
   */
  getTransactionsByType(operationType: OperationType): Array<{
    hash: string;
    metadata: TransactionMetadata;
  }> {
    const results: Array<{ hash: string; metadata: TransactionMetadata }> = [];
    
    for (const [hash, metadata] of this.trackedTransactions.entries()) {
      if (metadata.operationType === operationType) {
        results.push({ hash, metadata });
      }
    }

    return results;
  }

  /**
   * Parse return value from transaction
   * 
   * @param returnValue - ScVal return value
   * @returns Parsed native value
   */
  private parseReturnValue(returnValue: any): any {
    try {
      // Import scValToNative dynamically to avoid circular dependencies
      const { scValToNative } = require("@stellar/stellar-sdk");
      return scValToNative(returnValue);
    } catch (error) {
      console.warn("Failed to parse return value:", error);
      return returnValue;
    }
  }

  /**
   * Sleep utility for retry logic
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update network configuration
   * 
   * @param network - New network type
   * @param rpcUrl - Optional custom RPC URL
   */
  updateNetwork(network: NetworkType, rpcUrl?: string): void {
    this.network = network;
    
    if (rpcUrl) {
      this.rpcUrl = rpcUrl;
    } else {
      this.rpcUrl = network === "mainnet"
        ? process.env.SRB_MAINNET_PROVIDER_URL || "https://soroban.stellar.org"
        : process.env.SRB_PROVIDER_URL || "https://soroban-testnet.stellar.org";
    }

    this.server = new rpc.Server(this.rpcUrl, { allowHttp: true });
  }

  /**
   * Get network information
   * 
   * @returns Current network and RPC URL
   */
  getNetworkInfo(): { network: NetworkType; rpcUrl: string } {
    return {
      network: this.network,
      rpcUrl: this.rpcUrl,
    };
  }
}

/**
 * Create a default transaction tracker instance
 * 
 * @param config - Optional configuration
 * @returns TransactionTracker instance
 */
export function createTransactionTracker(
  config?: TransactionTrackerConfig
): TransactionTracker {
  return new TransactionTracker(config);
}
