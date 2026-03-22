/**
 * Tests for TypeScript Type Safety System
 */

import {
  createPublicKey,
  createContractAddress,
  createAmount,
  createAssetSymbol,
  createPercentage,
  createFee,
  createLedgerSequence,
  createTransactionHash,
  createContractMethod,
  multiplyAmount,
  divideAmount,
  createStrictConfig,
} from '../types/strict';

describe('TypeScript Type Safety', () => {
  describe('createPublicKey', () => {
    it('should create valid public key', () => {
      const key = createPublicKey('GBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3');
      expect(key).toBeDefined();
    });

    it('should reject invalid format', () => {
      expect(() => {
        createPublicKey('invalid-key');
      }).toThrow();
    });

    it('should reject wrong prefix', () => {
      expect(() => {
        createPublicKey('CBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3');
      }).toThrow();
    });
  });

  describe('createContractAddress', () => {
    it('should create valid contract address', () => {
      const addr = createContractAddress('CBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3');
      expect(addr).toBeDefined();
    });

    it('should reject wrong prefix', () => {
      expect(() => {
        createContractAddress('GBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3');
      }).toThrow();
    });
  });

  describe('createAmount', () => {
    it('should create valid amount from string', () => {
      const amount = createAmount('1000.50');
      expect(amount).toBeDefined();
    });

    it('should create valid amount from number', () => {
      const amount = createAmount(1000);
      expect(amount).toBeDefined();
    });

    it('should reject negative amounts', () => {
      expect(() => {
        createAmount('-100');
      }).toThrow();
    });

    it('should reject scientific notation', () => {
      expect(() => {
        createAmount('1e10');
      }).toThrow();
    });

    it('should validate decimal format', () => {
      expect(() => {
        createAmount('100.50.25');
      }).toThrow();
    });

    it('should handle many decimal places', () => {
      const amount = createAmount('1.000000000000000001');
      expect(amount).toBeDefined();
    });
  });

  describe('createAssetSymbol', () => {
    it('should create valid asset symbol', () => {
      const symbol = createAssetSymbol('USDC');
      expect(symbol).toBe('USDC');
    });

    it('should uppercase symbol', () => {
      const symbol = createAssetSymbol('usdc');
      expect(symbol).toBe('USDC');
    });

    it('should reject invalid characters', () => {
      expect(() => {
        createAssetSymbol('USD-C');
      }).toThrow();
    });

    it('should reject empty symbol', () => {
      expect(() => {
        createAssetSymbol('');
      }).toThrow();
    });
  });

  describe('createPercentage', () => {
    it('should create valid percentage', () => {
      const pct = createPercentage(50);
      expect(pct).toBe(50);
    });

    it('should reject < 0', () => {
      expect(() => {
        createPercentage(-1);
      }).toThrow();
    });

    it('should reject > 100', () => {
      expect(() => {
        createPercentage(101);
      }).toThrow();
    });

    it('should allow boundary values', () => {
      expect(createPercentage(0)).toBe(0);
      expect(createPercentage(100)).toBe(100);
    });
  });

  describe('createFee', () => {
    it('should create fee from string', () => {
      const fee = createFee('1000');
      expect(fee).toBeDefined();
    });

    it('should create fee from number', () => {
      const fee = createFee(1000);
      expect(fee).toBeDefined();
    });

    it('should reject negative fees', () => {
      expect(() => {
        createFee('-100');
      }).toThrow();
    });
  });

  describe('createLedgerSequence', () => {
    it('should create valid ledger sequence', () => {
      const seq = createLedgerSequence(12345);
      expect(seq).toBe(12345);
    });

    it('should reject negative numbers', () => {
      expect(() => {
        createLedgerSequence(-1);
      }).toThrow();
    });

    it('should reject floating point', () => {
      expect(() => {
        createLedgerSequence(123.45);
      }).toThrow();
    });
  });

  describe('createTransactionHash', () => {
    it('should create valid transaction hash', () => {
      const hash = createTransactionHash('a'.repeat(64));
      expect(hash).toBeDefined();
    });

    it('should normalize to lowercase', () => {
      const hash = createTransactionHash('A'.repeat(64));
      expect(hash).toContain('aaaa');
    });

    it('should reject wrong length', () => {
      expect(() => {
        createTransactionHash('abc');
      }).toThrow();
    });

    it('should reject invalid hex', () => {
      expect(() => {
        createTransactionHash(`z${'a'.repeat(63)}`);
      }).toThrow();
    });
  });

  describe('multiplyAmount', () => {
    it('should multiply amounts', () => {
      const amount = createAmount('100');
      const result = multiplyAmount(amount, 2);
      expect(result).toBeDefined();
    });
  });

  describe('divideAmount', () => {
    it('should divide amounts', () => {
      const amount = createAmount('100');
      const result = divideAmount(amount, 2);
      expect(result).toBeDefined();
    });
  });

  describe('createStrictConfig', () => {
    it('should create valid config', () => {
      const config = createStrictConfig({
        network: 'testnet',
        publicKey: 'GBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3',
        defaultSlippage: 0.5,
        defaultTimeout: 60,
      });

      expect(config.network).toBe('testnet');
      expect(config.defaultSlippage).toBe(0.5);
    });

    it('should validate public key in config', () => {
      expect(() => {
        createStrictConfig({
          network: 'testnet',
          publicKey: 'invalid',
          defaultSlippage: 0.5,
        });
      }).toThrow();
    });

    it('should set defaults', () => {
      const config = createStrictConfig({
        network: 'testnet',
        publicKey: 'GBBD47UZQ5DSFEO76KZVVYKRRWHQ3NXPML3GKHCFHZMPVQ6T4KV44CD3',
      });

      expect(config.defaultSlippage).toBe(1);
      expect(config.defaultTimeout).toBe(300);
      expect(config.maxFee).toBeDefined();
    });
  });
});
