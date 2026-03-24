import { describe, it, expect } from 'vitest';
import { StellarLiquidityContractTool } from '../../tools/contract';

describe('Contract Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(StellarLiquidityContractTool.name).toBe('stellar_liquidity_contract_tool');
    });

    it('should have a description', () => {
      expect(StellarLiquidityContractTool.description).toBeTruthy();
      expect(StellarLiquidityContractTool.description.length).toBeGreaterThan(0);
    });

    it('should have a schema defined', () => {
      expect(StellarLiquidityContractTool.schema).toBeDefined();
    });
  });

  describe('Action Types', () => {
    const validActions = ['swap', 'deposit', 'withdraw', 'get_share_id', 'get_reserves'] as const;

    it('should support all valid contract actions', () => {
      expect(validActions).toHaveLength(5);
      expect(validActions).toContain('swap');
      expect(validActions).toContain('deposit');
      expect(validActions).toContain('withdraw');
      expect(validActions).toContain('get_share_id');
      expect(validActions).toContain('get_reserves');
    });
  });
});
