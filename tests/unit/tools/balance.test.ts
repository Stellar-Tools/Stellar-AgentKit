import { describe, it, expect, vi } from 'vitest';
import { stellarGetBalanceTool, stellarGetAllBalancesTool } from '../../../tools/balance';
import { StrKey } from '@stellar/stellar-sdk';

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    Horizon: {
      Server: vi.fn().mockImplementation(() => ({
        loadAccount: vi.fn().mockResolvedValue({
          balances: [
            { asset_type: 'native', balance: '100.0000000' },
            { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GABC...', balance: '50.0000000' }
          ]
        })
      }))
    },
    StrKey: {
      isValidEd25519PublicKey: vi.fn().mockImplementation((addr) => addr.startsWith('G'))
    }
  };
});

describe('Balance Tools', () => {
  describe('stellar_get_balance', () => {
    it('should return native XLM balance by default', async () => {
      const result = await stellarGetBalanceTool.func({ address: 'GDRAW...' });
      expect(result).toBe('Balance: 100.0000000 XLM');
    });

    it('should return specific asset balance', async () => {
      const result = await stellarGetBalanceTool.func({ 
        address: 'GDRAW...', 
        assetCode: 'USDC', 
        assetIssuer: 'GABC...' 
      });
      expect(result).toBe('Balance: 50.0000000 USDC (GABC...)');
    });

    it('should return 0 for non-existent asset', async () => {
      const result = await stellarGetBalanceTool.func({ 
        address: 'GDRAW...', 
        assetCode: 'EURT', 
        assetIssuer: 'GXYZ...' 
      });
      expect(result).toBe('Balance: 0 EURT (GXYZ...)');
    });

    it('should validate address', async () => {
      const result = await stellarGetBalanceTool.func({ address: 'INVALID' });
      expect(result).toContain('Invalid Stellar address');
    });
  });

  describe('stellar_get_all_balances', () => {
    it('should return all balances formatted', async () => {
      const result = await stellarGetAllBalancesTool.func({ address: 'GDRAW...' });
      expect(result).toContain('XLM: 100.0000000');
      expect(result).toContain('USDC (GABC...): 50.0000000');
    });
  });
});
