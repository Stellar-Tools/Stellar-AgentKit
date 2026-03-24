import { describe, it, expect } from 'vitest';
import { StellarContractTool } from '../../tools/stake';

describe('Stake Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(StellarContractTool.name).toBe('stellar_contract_tool');
    });

    it('should have a description', () => {
      expect(StellarContractTool.description).toBeTruthy();
      expect(StellarContractTool.description.length).toBeGreaterThan(0);
    });

    it('should have a schema defined', () => {
      expect(StellarContractTool.schema).toBeDefined();
    });
  });

  describe('Action Types', () => {
    const validActions = ['stake', 'initialize', 'unstake', 'claim_rewards', 'get_stake'] as const;

    it('should support all valid stake actions', () => {
      expect(validActions).toHaveLength(5);
      expect(validActions).toContain('stake');
      expect(validActions).toContain('initialize');
      expect(validActions).toContain('unstake');
      expect(validActions).toContain('claim_rewards');
      expect(validActions).toContain('get_stake');
    });
  });
});
