import Big from "big.js";
import {
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  assetInputToSdkAsset,
  isNativeAssetInput,
  type StellarAssetInput,
} from "./assets";
import { getSigningKeypair, signTransaction } from "./stellar";

export interface PaymentClientConfig {
  network: "testnet" | "mainnet";
  horizonUrl: string;
  publicKey: string;
}

export interface SendPaymentParams {
  destination: string;
  amount: string;
  asset?: StellarAssetInput;
  memo?: string;
}

export interface SendPaymentResult {
  hash: string;
  network: PaymentClientConfig["network"];
  operation: "payment" | "create-account";
  destination: string;
  amount: string;
  asset: StellarAssetInput;
  memo?: string;
}

interface PaymentDependencies {
  createServer?: (horizonUrl: string) => {
    loadAccount: (publicKey: string) => Promise<any>;
    submitTransaction: (transaction: any) => Promise<{ hash: string }>;
  };
}

interface PaymentBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface DestinationAccountLike {
  balances?: PaymentBalanceLine[];
}

const DEFAULT_PAYMENT_ASSET: StellarAssetInput = { type: "native" };
const MAX_MEMO_BYTES = 28;

export async function sendPayment(
  client: PaymentClientConfig,
  params: SendPaymentParams,
  deps: PaymentDependencies = {}
): Promise<SendPaymentResult> {
  validatePublicKey(client.publicKey, "publicKey");
  validatePublicKey(params.destination, "destination");
  validateAmount(params.amount);
  validateMemo(params.memo);

  const asset = params.asset ?? DEFAULT_PAYMENT_ASSET;
  const sdkAsset = assetInputToSdkAsset(asset);

  getSigningKeypair(client.publicKey);

  const createServer =
    deps.createServer ?? ((horizonUrl: string) => new Horizon.Server(horizonUrl));
  const server = createServer(client.horizonUrl);
  const sourceAccount = await server.loadAccount(client.publicKey);

  const destinationAccount = await tryLoadAccount(server, params.destination);
  const operation = resolvePaymentOperation(asset, params.destination, destinationAccount);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(client.network),
    memo: params.memo ? Memo.text(params.memo) : undefined,
  });

  if (operation === "create-account") {
    transaction.addOperation(
      Operation.createAccount({
        destination: params.destination,
        startingBalance: params.amount,
      })
    );
  } else {
    transaction.addOperation(
      Operation.payment({
        destination: params.destination,
        asset: sdkAsset,
        amount: params.amount,
      })
    );
  }

  transaction.setTimeout(300);

  const signedXdr = signTransaction(
    transaction.build().toXDR(),
    getNetworkPassphrase(client.network),
    client.publicKey
  );
  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    getNetworkPassphrase(client.network)
  );

  const submission = await server.submitTransaction(signedTransaction);

  return {
    hash: submission.hash,
    network: client.network,
    operation,
    destination: params.destination,
    amount: params.amount,
    asset,
    memo: params.memo,
  };
}

function resolvePaymentOperation(
  asset: StellarAssetInput,
  destination: string,
  destinationAccount: DestinationAccountLike | null
): "payment" | "create-account" {
  if (!destinationAccount) {
    if (!isNativeAssetInput(asset)) {
      throw new Error(
        "Destination account does not exist. Issued-asset payments require an existing destination trustline."
      );
    }

    return "create-account";
  }

  if (
    !isNativeAssetInput(asset) &&
    destination !== asset.issuer &&
    !accountSupportsAsset(destinationAccount, asset)
  ) {
    throw new Error("Destination account does not trust the requested asset");
  }

  return "payment";
}

function accountSupportsAsset(
  account: DestinationAccountLike,
  asset: Exclude<StellarAssetInput, { type: "native" }>
): boolean {
  return (account.balances ?? []).some((balance) => {
    return (
      balance.asset_type !== "native" &&
      balance.asset_type !== "liquidity_pool_shares" &&
      balance.asset_code === asset.code &&
      balance.asset_issuer === asset.issuer
    );
  });
}

async function tryLoadAccount(
  server: {
    loadAccount: (publicKey: string) => Promise<any>;
  },
  publicKey: string
): Promise<DestinationAccountLike | null> {
  try {
    return await server.loadAccount(publicKey);
  } catch (error) {
    if (isAccountNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

function isAccountNotFoundError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

function validateAmount(amount: string) {
  try {
    const parsed = new Big(amount);
    if (parsed.lte(0)) {
      throw new Error("Amount must be greater than 0");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Amount must be greater than 0") {
      throw error;
    }

    throw new Error("Amount must be a valid positive Stellar amount");
  }

  const [, decimals] = amount.split(".");
  if (decimals && decimals.length > 7) {
    throw new Error("Amount cannot have more than 7 decimal places");
  }
}

function validateMemo(memo?: string) {
  if (!memo) {
    return;
  }

  if (Buffer.byteLength(memo, "utf8") > MAX_MEMO_BYTES) {
    throw new Error("Memo must be 28 bytes or fewer");
  }
}

function validatePublicKey(value: string, label: string) {
  if (!value || !StrKey.isValidEd25519PublicKey(value)) {
    throw new Error(`Invalid ${label} Stellar public key`);
  }
}

function getNetworkPassphrase(network: PaymentClientConfig["network"]): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}
