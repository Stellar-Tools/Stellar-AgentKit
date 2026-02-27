import { 
  Keypair, 
  Networks, 
  Asset, 
  TransactionBuilder, 
  Operation,
  Horizon
} from "@stellar/stellar-sdk";
import { AgentKitError, AgentKitErrorCode, AgentKitErrorCodeType } from "./errors";
import { withRetry } from "../utils/retry";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const HORIZON_MAINNET = "https://horizon.stellar.org";

const DECIMALS_MIN = 0;
const DECIMALS_MAX = 7;
const ASSET_CODE_REGEX = /^[a-zA-Z0-9]{1,12}$/;

export interface LaunchTokenParams {
  network: "testnet" | "mainnet";
  allowMainnetTokenIssuance?: boolean;
  symbol: string;
  decimals?: number;
  initialSupply: string;
  issuerSecretKey: string;
  distributorPublicKey: string;
  distributorSecretKey?: string;
  lockIssuer?: boolean;
}

function normalizeAmount(amount: string, decimals: number): string {
  const d = Math.min(Math.max(decimals, DECIMALS_MIN), DECIMALS_MAX);
  if (d === 7) return amount;
  const [whole = "0", frac = ""] = amount.split(".");
  const padded = frac.padEnd(d, "0").slice(0, d);
  return padded ? `${whole}.${padded}` : whole;
}

/**
 * Launch a Stellar classic asset: ensure trustline and mint initial supply to distributor.
 * Mainnet requires allowMainnetTokenIssuance and optionally ALLOW_MAINNET_TOKEN_ISSUANCE=true.
 * Idempotent: if trustline already exists, skips changeTrust and only mints if needed.
 */
export async function launchToken(params: LaunchTokenParams) {
  const {
    network,
    allowMainnetTokenIssuance = false,
    symbol,
    decimals = 7,
    initialSupply,
    issuerSecretKey,
    distributorPublicKey,
    distributorSecretKey,
    // lockIssuer = false, // Not implemented in MVP logic but present in params
  } = params;

  // Mainnet safeguard
  if (network === "mainnet") {
    const envAllowed = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE === "true";
    if (!allowMainnetTokenIssuance || !envAllowed) {
      throw new AgentKitError(
        AgentKitErrorCode.NETWORK_BLOCKED,
        "Token issuance on mainnet is disabled. Set allowMainnetTokenIssuance: true and ALLOW_MAINNET_TOKEN_ISSUANCE=true in .env to enable.",
        { network, symbol }
      );
    }
  }

  // Validation
  if (decimals < DECIMALS_MIN || decimals > DECIMALS_MAX) {
    throw new AgentKitError(
      AgentKitErrorCode.INVALID_DECIMALS as AgentKitErrorCodeType,
      `decimals must be between ${DECIMALS_MIN} and ${DECIMALS_MAX}`,
      { decimals, symbol }
    );
  }

  const supplyNum = parseFloat(initialSupply);
  if (isNaN(supplyNum) || supplyNum <= 0) {
    throw new AgentKitError(
      AgentKitErrorCode.INVALID_SUPPLY as AgentKitErrorCodeType,
      "initialSupply must be a positive number string",
      { initialSupply, symbol }
    );
  }

  if (!ASSET_CODE_REGEX.test(symbol)) {
    throw new AgentKitError(
      AgentKitErrorCode.INVALID_ADDRESS as AgentKitErrorCodeType,
      "symbol must be 1–12 alphanumeric characters",
      { symbol }
    );
  }

  const issuerKeypair = Keypair.fromSecret(issuerSecretKey);
  const issuerPublicKey = issuerKeypair.publicKey();
  const horizonUrl = network === "mainnet" ? HORIZON_MAINNET : HORIZON_TESTNET;
  const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  const server = new Horizon.Server(horizonUrl);

  const asset = new Asset(symbol, issuerPublicKey);
  const amountStr = normalizeAmount(initialSupply, decimals);

  let trustlineHash: string | undefined;
  let trustlineExisted = false;

  // 1) ChangeTrust from distributor (if we have distributor secret)
  if (distributorSecretKey) {
    try {
      const distributorAccount = await withRetry(() => server.loadAccount(distributorPublicKey));
      const distributorKeypair = Keypair.fromSecret(distributorSecretKey);
      const fee = await withRetry(() => server.fetchBaseFee());

      const trustTx = new TransactionBuilder(distributorAccount, {
        fee: String(fee),
        networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset,
            limit: "922337203685.4775807", // max int64 in decimal
          })
        )
        .setTimeout(100)
        .build();

      trustTx.sign(distributorKeypair);
      const trustResult = await withRetry(() => server.submitTransaction(trustTx));
      trustlineHash = trustResult.hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/trustline.*already exists|change_trust.*already exists/i.test(msg)) {
        trustlineExisted = true;
      } else {
        throw new AgentKitError(
          AgentKitErrorCode.TRUSTLINE_FAILED as AgentKitErrorCodeType,
          `Failed to create trustline: ${msg}`,
          { symbol, distributor: distributorPublicKey, operation: "changeTrust" },
          err instanceof Error ? err : undefined
        );
      }
    }
  }

  // 2) Payment from issuer to distributor (mint)
  let paymentHash: string;
  try {
    const issuerAccount = await withRetry(() => server.loadAccount(issuerPublicKey));
    const fee = await withRetry(() => server.fetchBaseFee());

    const paymentTx = new TransactionBuilder(issuerAccount, {
      fee: String(fee),
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: distributorPublicKey,
          asset,
          amount: amountStr,
        })
      )
      .setTimeout(100)
      .build();

    paymentTx.sign(issuerKeypair);
    const paymentResult = await withRetry(() => server.submitTransaction(paymentTx));
    paymentHash = paymentResult.hash;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AgentKitError(
      AgentKitErrorCode.MINT_FAILED as AgentKitErrorCodeType,
      `Failed to mint payment: ${msg}`,
      { symbol, amount: amountStr, distributor: distributorPublicKey },
      err instanceof Error ? err : undefined
    );
  }

  return {
    status: trustlineExisted && !trustlineHash ? "idempotent_skip" : "launched",
    symbol,
    issuer: issuerPublicKey,
    distributor: distributorPublicKey,
    trustlineHash,
    paymentHash,
  };
}
