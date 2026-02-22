import {
  swap as contractSwap,
  deposit as contractDeposit,
  withdraw as contractWithdraw,
  getReserves as contractGetReserves,
  getShareId as contractGetShareId,
} from "./lib/contract";
import { bridgeTokenTool } from "./tools/bridge";
import {
  Server,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE
} from "@stellar/stellar-sdk";

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
   * 
   * @param server Stellar server instance
   * @param accountPublicKey Account to check
   * @param asset Asset to check trustline for
   * @returns true if trustline exists, false otherwise
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
    } catch (error) {
      console.error(`Error checking trustline: ${error}`);
      return false;
    }
  }

  /**
   * Create a trustline between an account and an asset.
   * 
   * @param server Stellar server instance
   * @param accountKeypair Account keypair that will trust the asset
   * @param asset Asset to create trustline for
   * @param networkPassphrase Network passphrase
   * @returns Transaction hash of the trustline creation
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
            // No limit specified means unlimited trust
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
   * 
   * ⚠️ SECURITY WARNING: This operation is IRREVERSIBLE!
   * Once an issuer account is locked:
   * - No more tokens can ever be minted
   * - Account becomes immutable (cannot change signers, thresholds, etc.)
   * - This provides trust guarantees that supply is truly fixed
   * 
   * Use cases:
   * - Fixed supply tokens where no future minting is desired
   * - Decentralized assets where issuer control should be removed
   * - Compliance with certain token standards requiring immutable supply
   * 
   * @param server Stellar server instance
   * @param issuerKeypair Issuer account keypair
   * @param networkPassphrase Network passphrase
   * @returns Transaction hash of the locking operation
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
            // Set master weight to 0 - this makes the account immutable
            masterWeight: 0,
            // Remove the issuer as a signer (redundant but explicit)
            signer: {
              ed25519PublicKey: issuerKeypair.publicKey(),
              weight: 0
            }
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