import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";
import { stellarSendPaymentTool } from "./tools/stellar";
import {
  Server,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE
} from "@stellar/stellar-sdk";
import * as StellarSdk from "stellar-sdk";

export interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean; // Optional mainnet opt-in flag for general operations
}

export interface LaunchTokenParams {
  code: string;
  issuerSecret: string;
  distributorSecret: string;
  initialSupply: string;
  /**
   * Optional display/metadata decimals.
   *
   * NOTE: Stellar assets always have a fixed on-chain precision of 7 decimal places.
   * This field is currently ignored by the implementation and does NOT affect the
   * actual asset precision on the Stellar network.
   */
  decimals?: number;
  lockIssuer?: boolean;
}

export interface LaunchTokenResult {
  transactionHash: string;
  asset: {
    code: string;
    issuer: string;
  };
  distributorPublicKey: string;
  issuerLocked: boolean;
}

export class AgentClient {
  private network: "testnet" | "mainnet";
  private publicKey: string;
  private rpcUrl: string;

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
    this.rpcUrl = config.rpcUrl || (config.network === "mainnet" 
      ? "https://horizon.stellar.org" 
      : "https://horizon-testnet.stellar.org");
    
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
        if (b.asset_type === "liquidity_pool_shares") {
          const lp = b as StellarSdk.Horizon.HorizonApi.BalanceLineLiquidityPool;
          return { asset: `liquidity_pool:${lp.liquidity_pool_id}`, balance: lp.balance };
        }
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
        dataEntries: account.data_attr,
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

  /**
   * Launch a new token on the Stellar network.
   * 
   * ⚠️ SECURITY CRITICAL: This function handles sensitive operations:
   * - Creates new assets with issuer/distributor accounts
   * - Optionally locks issuer account (IRREVERSIBLE on mainnet)
   * - Requires explicit mainnet opt-in via allowMainnet config
   * 
   * NEVER log secrets or store them in class variables.
   * All secret keys are used in-memory only and discarded after use.
   * 
   * @param params Token launch parameters including secrets and configuration
   * @returns Transaction hash and asset details
   */
  async launchToken(params: LaunchTokenParams): Promise<LaunchTokenResult> {
    // 🔒 SECURITY: Additional mainnet safeguard for token launches
    if (this.network === "mainnet") {
      throw new Error(
        "🚫 Token launches on mainnet are disabled for security.\n" +
        "This prevents accidental creation of assets on the live network.\n" +
        "Token launches should be thoroughly tested on testnet first."
      );
    }

    const {
      code,
      issuerSecret,
      distributorSecret,
      initialSupply,
      decimals = 7,
      lockIssuer = false
    } = params;

    // 🔒 SECURITY: Validate inputs before processing
    if (!code || code.length === 0 || code.length > 12) {
      throw new Error("Asset code must be between 1 and 12 characters");
    }

    if (!/^[A-Za-z0-9]+$/.test(code)) {
      throw new Error("Asset code must contain only alphanumeric characters");
    }

    // 🔒 SECURITY: Warn about issuer locking - this is IRREVERSIBLE
    if (lockIssuer) {
      console.warn(
        "\n⚠️  WARNING: ISSUER ACCOUNT LOCKING ENABLED ⚠️\n" +
        "This will set the issuer's master weight to 0, making the account immutable.\n" +
        "This action is IRREVERSIBLE - no more tokens can ever be minted.\n" +
        "Ensure you have thoroughly tested token functionality before locking.\n"
      );
    }

    try {
      // Create keypairs from secrets (in-memory only, never stored)
      const issuerKeypair = Keypair.fromSecret(issuerSecret);
      const distributorKeypair = Keypair.fromSecret(distributorSecret);

      const issuerPublicKey = issuerKeypair.publicKey();
      const distributorPublicKey = distributorKeypair.publicKey();

      // Connect to Stellar network
      const server = new Server(this.rpcUrl);
      const networkPassphrase = this.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

      // Step 1: Load or create issuer account
      let issuerAccount;
      try {
        issuerAccount = await server.loadAccount(issuerPublicKey);
        console.log(`✓ Issuer account exists: ${issuerPublicKey}`);
      } catch (error) {
        throw new Error(
          `Issuer account ${issuerPublicKey} not found. ` +
          `Please fund the account before launching the token.`
        );
      }

      // Step 2: Load or create distributor account
      let distributorAccount;
      try {
        distributorAccount = await server.loadAccount(distributorPublicKey);
        console.log(`✓ Distributor account exists: ${distributorPublicKey}`);
      } catch (error) {
        throw new Error(
          `Distributor account ${distributorPublicKey} not found. ` +
          `Please fund the account before launching the token.`
        );
      }

      // Step 3: Create the asset
      const asset = new Asset(code, issuerPublicKey);
      console.log(`✓ Created asset: ${code}:${issuerPublicKey}`);

      // Step 4: Check and create trustline if needed
      const trustlineExists = await this.checkTrustlineExists(
        server, 
        distributorPublicKey, 
        asset
      );

      let trustlineHash: string | null = null;
      if (!trustlineExists) {
        console.log("Creating trustline from distributor to asset...");
        trustlineHash = await this.createTrustline(
          server,
          distributorKeypair,
          asset,
          networkPassphrase
        );
        console.log(`✓ Trustline created: ${trustlineHash}`);
      } else {
        console.log("✓ Trustline already exists");
      }

      // Step 5: Send initial supply from issuer to distributor
      console.log(`Minting ${initialSupply} ${code} tokens...`);
      const paymentTransaction = new TransactionBuilder(issuerAccount, {
        fee: BASE_FEE,
        networkPassphrase
      })
        .addOperation(
          Operation.payment({
            destination: distributorPublicKey,
            asset: asset,
            amount: initialSupply
          })
        )
        .setTimeout(300)
        .build();

      paymentTransaction.sign(issuerKeypair);
      const paymentResult = await server.submitTransaction(paymentTransaction);
      console.log(`✓ Initial supply minted: ${paymentResult.hash}`);

      let lockResult: { hash: string } | null = null;

      // Step 6: Optionally lock issuer account
      if (lockIssuer) {
        console.log("Locking issuer account...");
        lockResult = await this.lockIssuerAccount(
          server,
          issuerKeypair,
          networkPassphrase
        );
        console.log(`✓ Issuer account locked: ${lockResult.hash}`);
      }

      // Return the final transaction hash (payment or lock transaction)
      const finalTransactionHash = lockResult?.hash || paymentResult.hash;

      return {
        transactionHash: finalTransactionHash,
        asset: {
          code: code,
          issuer: issuerPublicKey
        },
        distributorPublicKey: distributorPublicKey,
        issuerLocked: lockIssuer
      };

    } catch (error) {
      console.error("Token launch failed:", error);
      throw new Error(`Token launch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a trustline exists between an account and an asset.
   */
  private async checkTrustlineExists(
    server: Server, 
    accountPublicKey: string, 
    asset: Asset
  ): Promise<boolean> {
    try {
      const account = await server.loadAccount(accountPublicKey);
      
      return account.balances.some(balance => {
        if (balance.asset_type === 'native') return false;
        
        return (
          balance.asset_code === asset.code &&
          balance.asset_issuer === asset.issuer
        );
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        return false;
      }

      console.error(`Error checking trustline: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a trustline between an account and an asset.
   */
  private async createTrustline(
    server: Server,
    accountKeypair: Keypair,
    asset: Asset,
    networkPassphrase: string
  ): Promise<string> {
    try {
      const account = await server.loadAccount(accountKeypair.publicKey());
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase
      })
        .addOperation(
          Operation.changeTrust({
            asset: asset,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(accountKeypair);
      const result = await server.submitTransaction(transaction);
      
      return result.hash;
    } catch (error) {
      throw new Error(`Failed to create trustline: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Lock an issuer account by setting master weight to 0.
   * ⚠️ IRREVERSIBLE!
   */
  private async lockIssuerAccount(
    server: Server,
    issuerKeypair: Keypair,
    networkPassphrase: string
  ): Promise<{ hash: string }> {
    try {
      const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
      
      const transaction = new TransactionBuilder(issuerAccount, {
        fee: BASE_FEE,
        networkPassphrase
      })
        .addOperation(
          Operation.setOptions({
            masterWeight: 0
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(issuerKeypair);
      const result = await server.submitTransaction(transaction);
      
      return { hash: result.hash };
    } catch (error) {
      throw new Error(`Failed to lock issuer account: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
