import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

export function getSigningKeypair(expectedPublicKey?: string): Keypair {
  const secret = process.env.STELLAR_PRIVATE_KEY;

  if (!secret) {
    throw new Error("Missing STELLAR_PRIVATE_KEY");
  }

  const keypair = Keypair.fromSecret(secret);

  if (expectedPublicKey && keypair.publicKey() !== expectedPublicKey) {
    throw new Error(
      "STELLAR_PRIVATE_KEY does not match the configured source public key"
    );
  }

  return keypair;
}

export const signTransaction = (
  txXDR: string,
  networkPassphrase: string,
  expectedPublicKey?: string
) => {
  const keypair = getSigningKeypair(expectedPublicKey);
  const transaction = TransactionBuilder.fromXDR(txXDR, networkPassphrase);
  transaction.sign(keypair);
  return transaction.toXDR();
};
