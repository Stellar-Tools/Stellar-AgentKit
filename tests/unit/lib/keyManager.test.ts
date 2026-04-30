import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { SecureKeyManager, getSecureSigningKeypair, signTransactionSecurely } from '../../../lib/keyManager';

describe('SecureKeyManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear any existing instance
    (SecureKeyManager as any).instance = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clear instance after each test
    (SecureKeyManager as any).instance = undefined;
  });

  describe('getSecureKeypair', () => {
    it('should throw error when STELLAR_PRIVATE_KEY is missing', () => {
      delete process.env.STELLAR_PRIVATE_KEY;
      
      const keyManager = SecureKeyManager.getInstance();
      
      expect(() => keyManager.getSecureKeypair()).toThrow(
        '🔒 STELLAR_PRIVATE_KEY not found in environment variables'
      );
    });

    it('should throw error for invalid private key format', () => {
      process.env.STELLAR_PRIVATE_KEY = 'invalid_key';
      
      const keyManager = SecureKeyManager.getInstance();
      
      expect(() => keyManager.getSecureKeypair()).toThrow(
        '🔒 Invalid STELLAR_PRIVATE_KEY format'
      );
    });

    it('should create keypair from valid private key', () => {
      // Generate a test keypair
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      const keyManager = SecureKeyManager.getInstance();
      const keypair = keyManager.getSecureKeypair();
      
      expect(keypair.publicKey()).toBe(testKeypair.publicKey());
    });

    it('should validate expected public key matches', () => {
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      const keyManager = SecureKeyManager.getInstance();
      
      expect(() => 
        keyManager.getSecureKeypair(testKeypair.publicKey())
      ).not.toThrow();
    });

    it('should throw error when expected public key does not match', () => {
      const testKeypair = Keypair.random();
      const wrongKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      const keyManager = SecureKeyManager.getInstance();
      
      expect(() => 
        keyManager.getSecureKeypair(wrongKeypair.publicKey())
      ).toThrow('🔒 STELLAR_PRIVATE_KEY does not match the expected public key');
    });
  });

  describe('encryptPrivateKey and decryptPrivateKey', () => {
    it('should encrypt and decrypt private key correctly', () => {
      const testKeypair = Keypair.random();
      const privateKey = testKeypair.secret();
      
      const keyManager = SecureKeyManager.getInstance();
      const encrypted = keyManager.encryptPrivateKey(privateKey);
      
      expect(encrypted.encryptedKey).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.timestamp).toBeDefined();
      
      const decrypted = keyManager.decryptPrivateKey(encrypted);
      expect(decrypted).toBe(privateKey);
    });

    it('should throw error for invalid private key format during encryption', () => {
      const keyManager = SecureKeyManager.getInstance();
      
      expect(() => keyManager.encryptPrivateKey('invalid_key')).toThrow(
        'Invalid Stellar private key format'
      );
    });

    it('should throw error when decrypting corrupted data', () => {
      const testKeypair = Keypair.random();
      const keyManager = SecureKeyManager.getInstance();
      const encrypted = keyManager.encryptPrivateKey(testKeypair.secret());
      
      // Corrupt the encrypted data
      encrypted.encryptedKey = 'corrupted_data';
      
      expect(() => keyManager.decryptPrivateKey(encrypted)).toThrow(
        'Failed to decrypt private key'
      );
    });
  });

  describe('generateSecureKeypair', () => {
    it('should generate a valid Stellar keypair', () => {
      const keyManager = SecureKeyManager.getInstance();
      const keypair = keyManager.generateSecureKeypair();
      
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
      expect(keypair.secret()).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('should generate different keypairs on each call', () => {
      const keyManager = SecureKeyManager.getInstance();
      const keypair1 = keyManager.generateSecureKeypair();
      const keypair2 = keyManager.generateSecureKeypair();
      
      expect(keypair1.publicKey()).not.toBe(keypair2.publicKey());
      expect(keypair1.secret()).not.toBe(keypair2.secret());
    });
  });

  describe('key rotation', () => {
    it('should rotate expired keys', async () => {
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      // Create key manager with short rotation interval
      const keyManager = SecureKeyManager.getInstance({
        keyRotationInterval: 100, // 100ms
        enableMemoryCleanup: false // Disable for testing
      });
      
      // Get keypair to cache it
      keyManager.getSecureKeypair();
      
      // Wait for rotation interval
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger rotation
      keyManager.rotateExpiredKeys();
      
      // Should not throw - this tests that rotation works
      expect(() => keyManager.rotateExpiredKeys()).not.toThrow();
    });
  });

  describe('wrapper functions', () => {
    it('should work with getSecureSigningKeypair wrapper', () => {
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      const keypair = getSecureSigningKeypair();
      expect(keypair.publicKey()).toBe(testKeypair.publicKey());
    });

    it('should work with signTransactionSecurely wrapper', () => {
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      // Mock TransactionBuilder for testing
      const mockTransaction = {
        sign: vi.fn(),
        toXDR: vi.fn().mockReturnValue('signed_xdr')
      };
      
      vi.doMock('@stellar/stellar-sdk', () => ({
        TransactionBuilder: {
          fromXDR: vi.fn().mockReturnValue(mockTransaction)
        }
      }));
      
      const result = signTransactionSecurely('test_xdr', 'test_passphrase');
      expect(result).toBe('signed_xdr');
      expect(mockTransaction.sign).toHaveBeenCalled();
    });
  });

  describe('security features', () => {
    it('should clear memory on clearMemory call', () => {
      const testKeypair = Keypair.random();
      process.env.STELLAR_PRIVATE_KEY = testKeypair.secret();
      
      const keyManager = SecureKeyManager.getInstance({
        enableMemoryCleanup: false // Disable automatic cleanup for testing
      });
      
      keyManager.getSecureKeypair();
      
      expect(() => keyManager.clearMemory()).not.toThrow();
    });

    it('should be singleton', () => {
      const instance1 = SecureKeyManager.getInstance();
      const instance2 = SecureKeyManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});