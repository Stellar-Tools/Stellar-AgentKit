/**
 * Updated AgentClient with comprehensive validation and error handling
 * 
 * This demonstrates the integration of the new validation and error handling framework.
 * Can be used to replace or augment the existing agent.ts file.
 */

import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "../lib/contract";
import { bridgeTokenTool } from "../tools/bridge";
import {
  validateNetwork,
  validateStellarAddress,
  validateSwapParams,
  validateDepositParams,
  validateWithdrawParams,
  validateBridgeParams,
  type SwapParams,
  type DepositParams,
  type WithdrawParams,
  type BridgeParams,
} from "../src/validation";
import {
  AgentKitError,
  InvalidNetworkError,
  OperationNotAllowedError,
} from "../src/errors";
import { handleError, retryWithBackoff } from "../src/errors/handlers";

export interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean;
  /** Enable validation (default: true) */
  validateInput?: boolean;
  /** Enable automatic retries (default: false). WARNING: Only safe for read-only operations. */
  autoRetry?: boolean;
  /** Explicit opt-in for retrying write operations (very dangerous - can cause duplicate transactions) */
  allowRetryOnWrites?: boolean;
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private rpcUrl?: string;
  private publicKey: string;
  private validateInput: boolean;
  private autoRetry: boolean;
  private allowRetryOnWrites: boolean;

  constructor(config: AgentConfig) {
    // Validate network
    try {
      this.network = validateNetwork(config.network);
    } catch (error) {
      throw new InvalidNetworkError(String(config.network));
    }

    // Mainnet safety check
    if (this.network === "mainnet" && !config.allowMainnet) {
      throw new OperationNotAllowedError(
        "mainnet operation",
        "Mainnet operations require explicit opt-in for safety",
        {},
        "Set allowMainnet: true in your config to enable mainnet operations"
      );
    }

    // Warning for mainnet usage
    if (this.network === "mainnet" && config.allowMainnet) {
      console.warn(
        "\n⚠️  WARNING: STELLAR MAINNET ACTIVE ⚠️\n" +
        "You are executing transactions on Stellar mainnet.\n" +
        "Real funds will be used. Double-check all parameters before proceeding.\n"
      );
    }

    this.publicKey = config.publicKey || process.env.STELLAR_PUBLIC_KEY || "";
    this.rpcUrl = config.rpcUrl;
    this.validateInput = config.validateInput !== false;
    
    // Auto-retry for reads is safe (idempotent)
    // Auto-retry for writes requires explicit opt-in (dangerous if not idempotent)
    // These are independently configurable
    this.autoRetry = config.autoRetry === true;  // Enable for safe read operations
    this.allowRetryOnWrites = config.allowRetryOnWrites === true;  // Separate control for write retries
  }

  /**
   * Perform a swap on the Stellar network with full validation
   */
  async swap(params: any): Promise<any> {
    if (this.validateInput) {
      params = validateSwapParams(params);
    }

    return await this.executeWriteWithRetry(() =>
      contractSwap(
        params.to,
        params.buyA,
        params.out,
        params.inMax,
        this.network
      )
    );
  }

  /**
   * Perform a bridge operation with validation
   */
  async bridge(params: any): Promise<any> {
    if (this.validateInput) {
      params = validateBridgeParams(params);
    }

    // Check if bridge operations are allowed on mainnet
    if (this.network === "mainnet" && process.env.ALLOW_MAINNET_BRIDGE !== "true") {
      throw new OperationNotAllowedError(
        "bridge",
        "Mainnet bridging requires additional security approval",
        {},
        "Set ALLOW_MAINNET_BRIDGE=true in your .env file"
      );
    }

    return await this.executeWriteWithRetry(() =>
      bridgeTokenTool.func({
        ...params,
        ...(this.rpcUrl ? { rpcUrl: this.rpcUrl } : {}),
      })
    );
  }

  /**
   * Liquidity pool operations
   */
  get lp() {
    return {
      deposit: async (params: any) => {
        if (this.validateInput) {
          params = validateDepositParams(params);
        }

        return await this.executeWriteWithRetry(() =>
          contractDeposit(params.to, params.desiredA, params.minA, params.desiredB, params.minB, this.network)
        );
      },

      withdraw: async (params: any) => {
        if (this.validateInput) {
          params = validateWithdrawParams(params);
        }

        return await this.executeWriteWithRetry(() =>
          contractWithdraw(params.to, params.shareAmount, params.minA, params.minB, this.network)
        );
      },

      getReserves: async () => {
        return await this.executeWithRetry(() => contractGetReserves(this.network));
      },

      getShareId: async () => {
        return await this.executeWithRetry(() => contractGetShareId(this.network));
      },
    };
  }

  /**
   * Execute read-only operation with optional retry logic
   * Retries are safe for read-only operations (idempotent)
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    if (this.autoRetry) {
      return await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });
    }

    return await operation();
  }

  /**
   * Execute write operation with optional retry logic
   * WARNING: Retries for write operations can cause duplicate transactions
   * Only enable if the operation is idempotent or you have duplicate detection
   */
  private async executeWriteWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    // For write operations, both autoRetry AND allowRetryOnWrites must be true
    if (this.autoRetry && this.allowRetryOnWrites) {
      console.warn(
        "⚠️ WARNING: Executing write operation with retry enabled. " +
        "This can cause duplicate transactions if the operation is not idempotent. " +
        "Ensure you have duplicate detection or idempotent operations before enabling this."
      );
      return await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });
    }

    return await operation();
  }

  /**
   * Get network info
   */
  getNetwork(): "testnet" | "mainnet" {
    return this.network;
  }

  /**
   * Get configured RPC URL, if any
   */
  getRpcUrl(): string | undefined {
    return this.rpcUrl;
  }

  /**
   * Get public key
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
