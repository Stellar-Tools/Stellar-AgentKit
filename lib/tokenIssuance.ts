import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Account,
  Horizon,
} from "@stellar/stellar-sdk";

const DEFAULT_TESTNET_URL = "https://horizon-testnet.stellar.org";
const DEFAULT_MAINNET_URL = "https://horizon.stellar.org";

export interface LaunchTokenParams {
  code: string;
  issuerSecret: string;
  distributorSecret: string;
  initialSupply: string;
  decimals?: number;
  lockIssuer?: boolean;
}

export interface LaunchTokenResult {
  success: boolean;
  assetCode: string;
  issuerPublicKey: string;
  distributorPublicKey: string;
  initialSupply: string;
  issuerLocked: boolean;
  trustlineHash?: string;
  mintHash?: string;
  lockHash?: string;
  network: "testnet" | "mainnet";
}

/**
 * Launch a new Stellar asset (token)
 *
 * This function performs the complete token issuance workflow:
 * 1. Validates issuer and distributor accounts
 * 2. Creates trustline from distributor to issuer
 * 3. Mints initial supply
 * 4. Optionally locks the issuer to prevent further issuance
 *
 * @param params Token launch parameters
 * @param network Network to use (testnet or mainnet)
 * @returns Launch result with transaction hashes
 */
export async function launchToken(
  params: LaunchTokenParams,
  network: "testnet" | "mainnet" = "testnet"
): Promise<LaunchTokenResult> {
  const {
    code,
    issuerSecret,
    distributorSecret,
    initialSupply,
    decimals = 7,
    lockIssuer = false,
  } = params;

  // Input validation
  if (!code || code.length === 0 || code.length > 12) {
    throw new Error(
      `Invalid asset code: "${code}". Asset code must be 1-12 alphanumeric characters.\n` +
      `Context:\n` +
      `  - Provided code: ${code}\n` +
      `  - Length: ${code.length}`
    );
  }

  if (!issuerSecret || !distributorSecret) {
    throw new Error(
      "Token issuance failed: Missing account secrets.\n" +
      `Context:\n` +
      `  - Issuer secret provided: ${!!issuerSecret}\n` +
      `  - Distributor secret provided: ${!!distributorSecret}`
    );
  }

  const supplyNum = parseFloat(initialSupply);
  if (isNaN(supplyNum) || supplyNum <= 0) {
    throw new Error(
      `Invalid initial supply: "${initialSupply}". Must be a positive number.\n` +
      `Context:\n` +
      `  - Provided value: ${initialSupply}\n` +
      `  - Parsed value: ${supplyNum}`
    );
  }

  try {
    // Initialize Stellar SDK components
    const horizonUrl = network === "mainnet" ? DEFAULT_MAINNET_URL : DEFAULT_TESTNET_URL;
    const server = new Horizon.Server(horizonUrl);
    const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

    // Load keypairs
    const issuerKeypair = Keypair.fromSecret(issuerSecret);
    const distributorKeypair = Keypair.fromSecret(distributorSecret);

    const issuerPublicKey = issuerKeypair.publicKey();
    const distributorPublicKey = distributorKeypair.publicKey();

    // Create asset
    const asset = new Asset(code, issuerPublicKey);

    let trustlineHash: string | undefined;
    let mintHash: string | undefined;
    let lockHash: string | undefined;

    // Step 1 & 2: Ensure accounts exist (handled by Horizon - accounts must exist)
    // Load distributor account for trustline transaction
    let distributorAccount: Account;
    try {
      distributorAccount = await server.loadAccount(distributorPublicKey);
    } catch (error: any) {
      throw new Error(
        `Failed to load distributor account.\n` +
        `Context:\n` +
        `  - Distributor public key: ${distributorPublicKey}\n` +
        `  - Network: ${network}\n` +
        `  - Error: ${error.message}\n` +
        `  - Hint: Account may not be funded. Use Friendbot (testnet) or fund the account.`
      );
    }

    // Step 3: Create trustline (distributor trusts issuer's asset)
    try {
      const trustlineTransaction = new TransactionBuilder(distributorAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset: asset,
            limit: initialSupply, // Set trust limit to initial supply
          })
        )
        .setTimeout(300)
        .build();

      trustlineTransaction.sign(distributorKeypair);
      const trustlineResult = await server.submitTransaction(trustlineTransaction);
      trustlineHash = trustlineResult.hash;
    } catch (error: any) {
      throw new Error(
        `Failed to create trustline.\n` +
        `Context:\n` +
        `  - Asset: ${code}\n` +
        `  - Issuer: ${issuerPublicKey}\n` +
        `  - Distributor: ${distributorPublicKey}\n` +
        `  - Trust limit: ${initialSupply}\n` +
        `  - Network: ${network}\n` +
        `  - Error: ${error.message}`
      );
    }

    // Step 4: Mint tokens (issuer sends to distributor)
    try {
      const issuerAccount = await server.loadAccount(issuerPublicKey);
      const mintTransaction = new TransactionBuilder(issuerAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: distributorPublicKey,
            asset: asset,
            amount: initialSupply,
          })
        )
        .setTimeout(300)
        .build();

      mintTransaction.sign(issuerKeypair);
      const mintResult = await server.submitTransaction(mintTransaction);
      mintHash = mintResult.hash;
    } catch (error: any) {
      throw new Error(
        `Failed to mint tokens.\n` +
        `Context:\n` +
        `  - Asset: ${code}\n` +
        `  - Issuer: ${issuerPublicKey}\n` +
        `  - Distributor: ${distributorPublicKey}\n` +
        `  - Amount: ${initialSupply}\n` +
        `  - Network: ${network}\n` +
        `  - Trustline hash: ${trustlineHash}\n` +
        `  - Error: ${error.message}`
      );
    }

    // Step 5: Optional issuer lock (prevent further issuance)
    if (lockIssuer) {
      try {
        const issuerAccount = await server.loadAccount(issuerPublicKey);
        const lockTransaction = new TransactionBuilder(issuerAccount, {
          fee: BASE_FEE,
          networkPassphrase,
        })
          .addOperation(
            Operation.setOptions({
              masterWeight: 0, // Set master key weight to 0
              lowThreshold: 1,
              medThreshold: 1,
              highThreshold: 1,
            })
          )
          .setTimeout(300)
          .build();

        lockTransaction.sign(issuerKeypair);
        const lockResult = await server.submitTransaction(lockTransaction);
        lockHash = lockResult.hash;
      } catch (error: any) {
        throw new Error(
          `Failed to lock issuer account.\n` +
          `Context:\n` +
          `  - Issuer: ${issuerPublicKey}\n` +
          `  - Network: ${network}\n` +
          `  - Trustline hash: ${trustlineHash}\n` +
          `  - Mint hash: ${mintHash}\n` +
          `  - Error: ${error.message}\n` +
          `  - Warning: Tokens were minted successfully, but issuer lock failed.`
        );
      }
    }

    return {
      success: true,
      assetCode: code,
      issuerPublicKey,
      distributorPublicKey,
      initialSupply,
      issuerLocked: lockIssuer,
      trustlineHash,
      mintHash,
      lockHash,
      network,
    };
  } catch (error: unknown) {
    // Re-throw if already our custom error
    if (error instanceof Error && error.message.includes("Context:")) {
      throw error;
    }

    // Wrap unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Token launch failed: ${errorMessage}\n` +
      `Context:\n` +
      `  - Asset code: ${code}\n` +
      `  - Initial supply: ${initialSupply}\n` +
      `  - Network: ${network}\n` +
      `  - Lock issuer: ${lockIssuer}`
    );
  }
}
