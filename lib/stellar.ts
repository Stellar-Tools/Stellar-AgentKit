import { Keypair, TransactionBuilder } from "stellar-sdk";

/**
 * Signs a Stellar transaction XDR using the private key from env
 */
export function signTransaction(
  txXDR: string,
  networkPassphrase: string
): string {
  const secretKey = process.env.STELLAR_PRIVATE_KEY;

  if (!secretKey) {
    throw new Error("Missing STELLAR_PRIVATE_KEY in environment variables");
  }

  if (!txXDR) {
    throw new Error("txXDR is required");
  }

  if (!networkPassphrase) {
    throw new Error("networkPassphrase is required");
  }

  const keypair = Keypair.fromSecret(secretKey);

  const transaction = TransactionBuilder.fromXDR(
    txXDR,
    networkPassphrase
  );

  transaction.sign(keypair);

  return transaction.toXDR();
}