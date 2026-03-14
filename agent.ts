import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";
import {
  TransactionTracker,
  TransactionStatusResponse,
  OperationType,
} from "./lib/transactionTracker";

export interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean; // Optional mainnet opt-in flag for general operations
  enableTracking?: boolean; // Enable transaction tracking
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private publicKey: string;
  private tracker: TransactionTracker | null;

  constructor(config: AgentConfig) {
    // Mainnet safety check for general operations
    if (config.network === "mainnet" && !config.allowMainnet) {
      throw new Error(
        " Mainnet execution blocked for safety.\n" +
        "Stellar AgentKit requires explicit opt-in for mainnet operations to prevent accidental use of real funds.\n" +
        "To enable mainnet, set allowMainnet: true in your config:\n" +
        "  new AgentClient({ network: 'mainnet', allowMainnet: true, ... })"
      );
    }

    // Warning for mainnet usage (when opted in)
    if (config.network === "mainnet" && config.allowMainnet) {
      console.warn(
        "\n⚠️  WARNING: STELLAR MAINNET ACTIVE ⚠️\n" +
        "You are executing transactions on Stellar mainnet.\n" +
        "Real funds will be used. Double-check all parameters before proceeding.\n"
      );
    }

    this.network = config.network;
    this.publicKey = config.publicKey || process.env.STELLAR_PUBLIC_KEY || "";
    
    // Initialize transaction tracker if enabled
    if (config.enableTracking !== false) {
      this.tracker = new TransactionTracker({
        network: config.network,
        rpcUrl: config.rpcUrl,
      });
    } else {
      this.tracker = null;
    }
    
    if (!this.publicKey && this.network === "testnet") {
        // In a real SDK, we might not throw here if only read-only methods are used,
        // but for this implementation, we'll assume it's needed for most actions.
    }
  }

  /**
   * Perform a swap on the Stellar network.
   * @param params Swap parameters
   */
  async swap(params: {
    to: string;
    buyA: boolean;
    out: string;
    inMax: string;
  }) {
    return await contractSwap(
      this.publicKey,
      params.to,
      params.buyA,
      params.out,
      params.inMax
    );
  }

  /**
   * Bridge tokens from Stellar to EVM compatible chains.
   * 
   * ⚠️ IMPORTANT: Mainnet bridging requires BOTH:
   * 1. AgentClient initialized with allowMainnet: true
   * 2. ALLOW_MAINNET_BRIDGE=true in your .env file
   * 
   * This dual-safeguard approach prevents accidental mainnet bridging.
   * 
   * @param params Bridge parameters
   * @returns Bridge transaction result with status, hash, and network
   */
  async bridge(params: {
    amount: string;
    toAddress: string;
  }) {
    return await bridgeTokenTool.func({
      ...params,
      fromNetwork:
        this.network === "mainnet"
          ? "stellar-mainnet"
          : "stellar-testnet",
    });
  }

  /**
   * Get transaction status
   * 
   * @param hash - Transaction hash to query
   * @returns Transaction status details
   */
  async getTransactionStatus(hash: string): Promise<TransactionStatusResponse | null> {
    if (!this.tracker) {
      throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
    }
    return await this.tracker.getTransactionStatus(hash);
  }

  /**
   * Wait for transaction confirmation
   * 
   * @param hash - Transaction hash to monitor
   * @param operationType - Type of operation
   * @returns Final transaction status
   */
  async waitForConfirmation(
    hash: string,
    operationType: OperationType
  ): Promise<TransactionStatusResponse | null> {
    if (!this.tracker) {
      throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
    }
    return await this.tracker.waitForConfirmation(hash, operationType);
  }

  /**
   * Monitor multiple transactions
   * 
   * @param hashes - Array of transaction hashes
   * @param operationType - Type of operation
   * @returns Array of transaction statuses
   */
  async monitorTransactions(
    hashes: string[],
    operationType: OperationType
  ): Promise<TransactionStatusResponse[]> {
    if (!this.tracker) {
      throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
    }
    return await this.tracker.monitorTransactions(hashes, operationType);
  }

  /**
   * Get transaction tracker instance
   * 
   * @returns TransactionTracker instance or null if disabled
   */
  getTracker(): TransactionTracker | null {
    return this.tracker;
  }

  /**
   * Liquidity Pool operations.
   */
  public lp = {
    deposit: async (params: {
      to: string;
      desiredA: string;
      minA: string;
      desiredB: string;
      minB: string;
    }) => {
      return await contractDeposit(
        this.publicKey,
        params.to,
        params.desiredA,
        params.minA,
        params.desiredB,
        params.minB
      );
    },

    withdraw: async (params: {
      to: string;
      shareAmount: string;
      minA: string;
      minB: string;
    }) => {
      return await contractWithdraw(
        this.publicKey,
        params.to,
        params.shareAmount,
        params.minA,
        params.minB
      );
    },

    getReserves: async () => {
      return await contractGetReserves(this.publicKey);
    },

    getShareId: async () => {
      return await contractGetShareId(this.publicKey);
    },
  };
}