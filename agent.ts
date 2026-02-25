import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";
import { stellarSendPaymentTool } from "./tools/stellar";
import * as StellarSdk from "stellar-sdk";

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
   * Send XLM or any Stellar asset to another account.
   *
   * @param params Payment parameters
   * @param params.to Recipient Stellar address (G...)
   * @param params.amount Amount to send as string (e.g. "100")
   * @param params.asset_code Optional asset code for custom tokens (e.g. "USDC"). Omit for native XLM.
   * @param params.asset_issuer Required when asset_code is set. Issuer public key of the token.
   * @param params.memo Optional text memo (max 28 bytes)
   *
   * @example
   * // Send XLM
   * await agent.sendPayment({ to: "GCXXX...", amount: "10" });
   *
   * @example
   * // Send USDC
   * await agent.sendPayment({
   *   to: "GCXXX...",
   *   amount: "50",
   *   asset_code: "USDC",
   *   asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
   *   memo: "Invoice #42",
   * });
   */
  async sendPayment(params: {
    to: string;
    amount: string;
    asset_code?: string;
    asset_issuer?: string;
    memo?: string;
  }): Promise<string> {
    return await stellarSendPaymentTool.func({
      recipient: params.to,
      amount: params.amount,
      asset_code: params.asset_code,
      asset_issuer: params.asset_issuer,
      memo: params.memo,
      network: this.network,
    });
  }

  /**
   * Get XLM and token balances for a Stellar account.
   *
   * @param publicKey Stellar public key to query. Defaults to the AgentClient's publicKey.
   * @returns Object with balances array: [{ asset: "XLM", balance: "100.0000000" }, ...]
   *
   * @example
   * const result = await agent.getBalance();
   * const parsed = JSON.parse(result);
   * console.log(parsed.balances); // [{ asset: 'XLM', balance: '99.9999600' }]
   */
  async getBalance(publicKey?: string): Promise<string> {
    const key = publicKey || this.publicKey;
    if (!key) throw new Error("publicKey is required (pass it or set in AgentConfig)");

    const horizonUrl =
      this.network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";
    const server = new StellarSdk.Horizon.Server(horizonUrl);

    try {
      const account = await server.loadAccount(key);
      const balances = account.balances.map((b) => {
        if (b.asset_type === "native") return { asset: "XLM", balance: b.balance };
        const bal = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
        return { asset: `${bal.asset_code}:${bal.asset_issuer}`, balance: bal.balance };
      });
      return JSON.stringify({ publicKey: key, network: this.network, balances });
    } catch (error) {
      const msg =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error";
      throw new Error(`getBalance failed for ${key.slice(0, 8)}...: ${msg}`);
    }
  }

  /**
   * Get full account information for a Stellar address.
   *
   * @param publicKey Stellar public key to query. Defaults to the AgentClient's publicKey.
   * @returns Full account details: sequence, thresholds, flags, signers, data entries.
   *
   * @example
   * const info = await agent.getAccountInfo();
   * const parsed = JSON.parse(info);
   * console.log(parsed.sequence); // "12345678"
   */
  async getAccountInfo(publicKey?: string): Promise<string> {
    const key = publicKey || this.publicKey;
    if (!key) throw new Error("publicKey is required (pass it or set in AgentConfig)");

    const horizonUrl =
      this.network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";
    const server = new StellarSdk.Horizon.Server(horizonUrl);

    try {
      const account = await server.loadAccount(key);
      const info = {
        publicKey: account.id,
        network: this.network,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentry_count,
        thresholds: account.thresholds,
        flags: account.flags,
        signers: account.signers.map((s) => ({ key: s.key, weight: s.weight, type: s.type })),
        balanceCount: account.balances.length,
        dataEntryCount: Object.keys(account.data_attr).length,
      };
      return JSON.stringify(info);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { title?: string } }; message?: string })
          .response?.data?.title ||
        (error as Error).message ||
        "Unknown error";
      throw new Error(`getAccountInfo failed for ${key.slice(0, 8)}...: ${msg}`);
    }
  }
}