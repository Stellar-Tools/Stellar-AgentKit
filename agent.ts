import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";

export interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean; // Optional mainnet opt-in flag for general operations
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private publicKey: string;

  constructor(config: AgentConfig) {
    // Mainnet safety check for general operations
    if (config.network === "mainnet" && !config.allowMainnet) {
      throw new Error(
        "🚫 Mainnet execution blocked for safety.\n" +
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
    try {
      return await contractSwap(
        this.publicKey,
        params.to,
        params.buyA,
        params.out,
        params.inMax
      );
    } catch (error) {
      throw new Error(this.formatSwapError(params, error), { cause: error as unknown });
    }
  }

  /**
   * Private helper method to format swap error messages with context
   */
  private formatSwapError(params: {
    to: string;
    buyA: boolean;
    out: string;
    inMax: string;
  }, originalError: unknown): string {
    const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
    
    // Mask parts of addresses in logs for privacy/readability (addresses are public on-chain)
    const maskedRecipient = params.to.substring(0, 4) + "..." + params.to.substring(params.to.length - 4);
    
    return `Swap operation failed.
Network: ${this.network}
Recipient: ${maskedRecipient}
Direction: buyA=${params.buyA}
Requested Out: ${params.out}
Max Input: ${params.inMax}
Reason: ${originalMessage}`;
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
    try {
      return await bridgeTokenTool.func({
        ...params,
        fromNetwork:
          this.network === "mainnet"
            ? "stellar-mainnet"
            : "stellar-testnet",
      });
    } catch (error) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      const maskedAddress = params.toAddress.substring(0, 4) + "..." + params.toAddress.substring(params.toAddress.length - 4);
      
      throw new Error(`Bridge operation failed.
Network: ${this.network}
To Address: ${maskedAddress}
Amount: ${params.amount}
Reason: ${originalMessage}`);
    }
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
      try {
        return await contractDeposit(
          this.publicKey,
          params.to,
          params.desiredA,
          params.minA,
          params.desiredB,
          params.minB
        );
      } catch (error) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const maskedRecipient = params.to.substring(0, 4) + "..." + params.to.substring(params.to.length - 4);
        
        throw new Error(`Liquidity deposit failed.
Network: ${this.network}
Recipient: ${maskedRecipient}
Desired A: ${params.desiredA}
Min A: ${params.minA}
Desired B: ${params.desiredB}
Min B: ${params.minB}
Reason: ${originalMessage}`);
      }
    },

    withdraw: async (params: {
      to: string;
      shareAmount: string;
      minA: string;
      minB: string;
    }) => {
      try {
        return await contractWithdraw(
          this.publicKey,
          params.to,
          params.shareAmount,
          params.minA,
          params.minB
        );
      } catch (error) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const maskedRecipient = params.to.substring(0, 4) + "..." + params.to.substring(params.to.length - 4);
        
        throw new Error(`Liquidity withdrawal failed.
Network: ${this.network}
Recipient: ${maskedRecipient}
Share Amount: ${params.shareAmount}
Min A: ${params.minA}
Min B: ${params.minB}
Reason: ${originalMessage}`);
      }
    },

    getReserves: async () => {
      try {
        return await contractGetReserves(this.publicKey);
      } catch (error) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get reserves on ${this.network}. Reason: ${originalMessage}`);
      }
    },

    getShareId: async () => {
      try {
        return await contractGetShareId(this.publicKey);
      } catch (error) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get share ID on ${this.network}. Reason: ${originalMessage}`);
      }
    },
  };
}