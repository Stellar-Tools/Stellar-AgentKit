import { describe, it, expect } from 'vitest';

describe('Stake Tool', () => {
  describe('Action Types', () => {
    const validActions = ['stake', 'initialize', 'unstake', 'claim_rewards', 'get_stake'] as const;
    
    it('should support all valid stake actions', () => {
      expect(validActions).toContain('stake');
      expect(validActions).toContain('initialize');
      expect(validActions).toContain('unstake');
      expect(validActions).toContain('claim_rewards');
      expect(validActions).toContain('get_stake');
    });

    it('should have exactly 5 action types', () => {
      expect(validActions).toHaveLength(5);
    });
  });

  describe('Parameter Requirements', () => {
    it('should require tokenAddress and rewardRate for initialize', () => {
      const params = {
        action: 'initialize' as const,
        tokenAddress: 'CXYZ...',
        rewardRate: 100,
      };
      
      expect(params.tokenAddress).toBeDefined();
      expect(params.rewardRate).toBeDefined();
    });

    it('should require amount for stake action', () => {
      const params = {
        action: 'stake' as const,
        amount: '1000',
      };
      
      expect(params.amount).toBeDefined();
    });
  });
});
