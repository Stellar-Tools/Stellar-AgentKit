import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stellarGetBalanceTool, stellarGetAllBalancesTool } from '../../../tools/balance';
import { StrKey } from '@stellar/stellar-sdk';

// Mock Stellar SDK
const mockLoadAccount = vi.fn();

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    Horizon: {
      Server: vi.fn().mockImplementation(function () {
        return {
          loadAccount: mockLoadAccount
        };
      })
    },
    StrKey: {
      isValidEd25519PublicKey: vi.fn().mockImplementation((addr: string) => addr && addr.startsWith('G'))
    }
  };
});

describe('Balance Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAccount.mockResolvedValue({
      balances: [
        { asset_type: 'native', balance: '100.0000000' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GABC...', balance: '50.0000000' }
      ]
    });
  });

  describe('stellar_get_balance', () => {
    it('should return native XLM balance by default', async () => {
      const address = 'GDRAW...';
      const result = await stellarGetBalanceTool.func({ address });
      
      expect(mockLoadAccount).toHaveBeenCalledWith(address);
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

    it('should detect ambiguity when multiple issuers exist', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '100.0' },
          { asset_type: 'credit_alphanum4', asset_code: 'TEST', asset_issuer: 'G1...', balance: '10.0' },
          { asset_type: 'credit_alphanum4', asset_code: 'TEST', asset_issuer: 'G2...', balance: '20.0' }
        ]
      });

      const result = await stellarGetBalanceTool.func({ 
        address: 'GDRAW...', 
        assetCode: 'TEST'
      });
      expect(result).toContain('Ambiguity detected');
      expect(result).toContain('G1...');
      expect(result).toContain('G2...');
    });

    it('should validate address', async () => {
      const result = await stellarGetBalanceTool.func({ address: 'INVALID' });
      expect(result).toContain('Invalid Stellar address');
    });
  });

  describe('stellar_get_all_balances', () => {
    it('should return all balances including LP shares', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '100.0000000' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GABC...', balance: '50.0000000' },
          { asset_type: 'liquidity_pool_shares', liquidity_pool_id: 'lp123', balance: '5.0' }
        ]
      });

      const result = await stellarGetAllBalancesTool.func({ address: 'GDRAW...' });
      expect(result).toContain('XLM: 100.0000000');
      expect(result).toContain('USDC (GABC...): 50.0000000');
      expect(result).toContain('LP Share (lp123): 5.0');
    });
  });
});
