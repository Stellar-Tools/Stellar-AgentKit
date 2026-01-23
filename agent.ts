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
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private publicKey: string;

  constructor(config: AgentConfig) {
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
   * @param params Bridge parameters
   */
  async bridge(params: {
    amount: string;
    toAddress: string;
  }) {
    // Calling the internal tool function
    return await bridgeTokenTool.func(params);
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
