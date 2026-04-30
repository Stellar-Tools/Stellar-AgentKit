import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { getSecureSigningKeypair, signTransactionSecurely } from "./keyManager";

/**
 * Get a signing keypair with enhanced security features
 * 
 * 🔒 SECURITY: Now uses SecureKeyManager for enhanced protection
 * - Validates key format before processing
 * - Uses constant-time comparison for public key validation
 * - Automatic memory cleanup and key rotation
 * 
 * @param expectedPublicKey Optional public key for validation
 * @returns Stellar keypair with security enhancements
 */
export function getSigningKeypair(expectedPublicKey?: string): Keypair {
  return getSecureSigningKeypair(expectedPublicKey);
}

/**
 * Sign a transaction with enhanced security
 * 
 * 🔒 SECURITY: Uses secure key management and automatic cleanup
 * 
 * @param txXDR Transaction XDR to sign
 * @param networkPassphrase Network passphrase
 * @param expectedPublicKey Optional public key validation
 * @returns Signed transaction XDR
 */
export const signTransaction = (
  txXDR: string,
  networkPassphrase: string,
  expectedPublicKey?: string
): string => {
  return signTransactionSecurely(txXDR, networkPassphrase, expectedPublicKey);
};
