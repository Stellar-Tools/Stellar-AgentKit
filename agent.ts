import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";
import { sendPayment } from "./tools/stellar";
import { getAccountBalances } from "./tools/getBalance";
import {
  initialize as stakeInitialize,
  stake as stakeStake,
  unstake as stakeUnstake,
  claimRewards as stakeClaimRewards,
  getStake as stakeGetStake,
} from "./lib/stakeF";
import {
  launchToken as launchTokenLib,
  LaunchTokenParams,
  LaunchTokenResult,
} from "./lib/tokenIssuance";

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
   * Send native XLM payment
   * @param params Payment parameters
   */
  async send(params: {
    recipient: string;
    amount: string;
  }) {
    return await sendPayment(this.publicKey, params.recipient, params.amount, this.network);
  }

  /**
   * Get account balances for a Stellar address
   * @param publicKey Optional public key (defaults to agent's publicKey)
   */
  async getBalance(publicKey?: string) {
    const targetKey = publicKey || this.publicKey;
    return await getAccountBalances(targetKey, this.network);
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

  /**
   * Staking contract operations
   */
  public staking = {
    initialize: async (params: {
      tokenAddress: string;
      rewardRate: string;
    }) => {
      return await stakeInitialize(
        this.publicKey,
        params.tokenAddress,
        params.rewardRate
      );
    },

    stake: async (params: { amount: string }) => {
      return await stakeStake(this.publicKey, params.amount);
    },

    unstake: async (params: { amount: string }) => {
      return await stakeUnstake(this.publicKey, params.amount);
    },

    claimRewards: async () => {
      return await stakeClaimRewards(this.publicKey);
    },

    getStake: async (userAddress: string) => {
      return await stakeGetStake(this.publicKey, userAddress);
    },
  };

  /**
   * Launch a new Stellar asset (token)
   *
   * Creates a custom asset with the specified parameters.
   * Performs the full issuance workflow:
   * 1. Creates trustline from distributor to issuer
   * 2. Mints initial supply
   * 3. Optionally locks issuer to create fixed supply
   *
   * @param params Token launch parameters
   */
  async launchToken(params: LaunchTokenParams): Promise<LaunchTokenResult> {
    // Mainnet safety check
    if (this.network === "mainnet") {
      if (process.env.ALLOW_MAINNET_TOKEN_ISSUANCE !== "true") {
        throw new Error(
          "🚫 Mainnet token issuance blocked for safety.\n" +
          "Creating tokens on mainnet will create real, immutable assets.\n" +
          "To enable, set ALLOW_MAINNET_TOKEN_ISSUANCE=true in your .env file."
        );
      }

      console.warn(
        "\n⚠️  WARNING: CREATING MAINNET ASSET ⚠️\n" +
        `You are about to create asset "${params.code}" on Stellar MAINNET.\n` +
        "This asset will exist permanently on the blockchain.\n" +
        `${params.lockIssuer ? "The issuer will be LOCKED (fixed supply).\n" : ""}`+
        "Double-check all parameters before proceeding.\n"
      );
    }

    return await launchTokenLib(params, this.network);
  }
}