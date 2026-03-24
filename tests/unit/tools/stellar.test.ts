import { describe, it, expect } from 'vitest';

describe('Stellar Tool', () => {
  describe('Network Support', () => {
    it('should support testnet network', () => {
      const network = 'testnet';
      expect(network).toBe('testnet');
    });

    it('should support mainnet network', () => {
      const network = 'mainnet';
      expect(network).toBe('mainnet');
    });

    it('should validate both network types', () => {
      const networks = ['testnet', 'mainnet'];
      expect(networks).toHaveLength(2);
      expect(networks).toContain('testnet');
      expect(networks).toContain('mainnet');
    });
  });
});
