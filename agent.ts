import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { launchToken as contractLaunchToken, LaunchTokenParams } from "./lib/launchToken";
import { bridgeTokenTool } from "./tools/bridge";
import { StrKey } from "@stellar/stellar-sdk";
import { AgentKitError, AgentKitErrorCode } from "./lib/errors";
import {
  initialize as stakeInitialize,
  stake as stakeDeposit,
  unstake as stakeWithdraw,
  claimRewards as stakeClaimRewards,
  getStake as stakeGetStake,
} from "./lib/stakeF";
import { stellarGetBalanceTool } from "./tools/account";
import { stellarEnsureTrustlineTool } from "./tools/trustline";

export interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean; // Optional mainnet opt-in flag for general operations
  allowMainnetTokenIssuance?: boolean; // Safeguard for token issuance
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private publicKey: string;
  private allowMainnetTokenIssuance: boolean;

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
    this.allowMainnetTokenIssuance = config.allowMainnetTokenIssuance || false;
    
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
    if (!StrKey.isValidEd25519PublicKey(params.to)) {
      throw new AgentKitError(
        AgentKitErrorCode.INVALID_ADDRESS,
        `Invalid recipient address format: ${params.to}`,
        { to: params.to, operation: "swap" }
      );
    }
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
    assetSymbol?: string;
  }) {
    return await bridgeTokenTool.func({
      ...params,
      assetSymbol: params.assetSymbol || "USDC",
      fromNetwork:
        this.network === "mainnet"
          ? "stellar-mainnet"
          : "stellar-testnet",
    });
  }

  /**
   * Launch a Stellar token (classic asset).
   * 
   * ⚠️ IMPORTANT: Mainnet issuance requires BOTH:
   * 1. AgentClient initialized with allowMainnetTokenIssuance: true
   * 2. ALLOW_MAINNET_TOKEN_ISSUANCE=true in your .env file
   * 
   * @param params Issuance parameters
   * @returns Issuance result 
   */
  async launchToken(params: Omit<LaunchTokenParams, "network" | "allowMainnetTokenIssuance">) {
    if (!StrKey.isValidEd25519PublicKey(params.distributorPublicKey)) {
      throw new AgentKitError(
        AgentKitErrorCode.INVALID_ADDRESS,
        `Invalid distributor address format: ${params.distributorPublicKey}`,
        { to: params.distributorPublicKey, operation: "launchToken" }
      );
    }
    return await contractLaunchToken({
      ...params,
      network: this.network,
      allowMainnetTokenIssuance: this.allowMainnetTokenIssuance
    });
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
      if (!StrKey.isValidEd25519PublicKey(params.to)) {
        throw new AgentKitError(
          AgentKitErrorCode.INVALID_ADDRESS,
          `Invalid recipient address format: ${params.to}`,
          { to: params.to, operation: "lp.deposit" }
        );
      }
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
      if (!StrKey.isValidEd25519PublicKey(params.to)) {
        throw new AgentKitError(
          AgentKitErrorCode.INVALID_ADDRESS,
          `Invalid recipient address format: ${params.to}`,
          { to: params.to, operation: "lp.withdraw" }
        );
      }
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
   * Staking operations.
   */
  public stake = {
    initialize: async (params: { tokenAddress: string; rewardRate: number }) => {
      return await stakeInitialize(this.publicKey, params.tokenAddress, params.rewardRate);
    },

    deposit: async (amount: number) => {
      return await stakeDeposit(this.publicKey, amount);
    },

    withdraw: async (amount: number) => {
      return await stakeWithdraw(this.publicKey, amount);
    },

    claimRewards: async () => {
      return await stakeClaimRewards(this.publicKey);
    },

    getStake: async (userAddress: string) => {
      if (!StrKey.isValidEd25519PublicKey(userAddress)) {
        throw new AgentKitError(
          AgentKitErrorCode.INVALID_ADDRESS,
          `Invalid user address format for getStake: ${userAddress}`,
          { to: userAddress, operation: "stake.getStake" }
        );
      }
      return await stakeGetStake(this.publicKey, userAddress);
    },
  };

  /**
   * Account & Asset management.
   */
  async getBalances(address?: string) {
    return await stellarGetBalanceTool.func({
      address: address || this.publicKey,
      network: this.network,
    });
  }

  async ensureTrustline(params: { assetCode: string; assetIssuer: string }) {
    return await stellarEnsureTrustlineTool.func({
      ...params,
      network: this.network,
    });
  }
}