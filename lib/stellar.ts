import { Keypair, TransactionBuilder } from "stellar-sdk";

export const signTransaction = (txXDR: string, networkPassphrase: string, secretKey?: string) => {
  const finalSecret = secretKey || process.env.STELLAR_PRIVATE_KEY;
  if (!finalSecret) {
    throw new Error("No Stellar secret key provided for signing. Set STELLAR_PRIVATE_KEY in .env or pass it explicitly.");
  }
  const keypair = Keypair.fromSecret(finalSecret);
  const transaction = TransactionBuilder.fromXDR(txXDR, networkPassphrase);
  transaction.sign(keypair);
  return transaction.toXDR();
};
  