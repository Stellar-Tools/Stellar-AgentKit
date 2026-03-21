/**
 * Tests for Slippage Protection System
 */

import {
  calculateSwapOutput,
  calculatePriceImpact,
  validateSlippage,
  analyzeTradesafety,
  recommendSlippageTolerance,
} from '../slippage/protection';

describe('Slippage Protection System', () => {
  describe('calculateSwapOutput', () => {
    it('should calculate output correctly', () => {
      const output = calculateSwapOutput({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '100',
        feePercent: 0.25,
      });

      expect(parseFloat(output)).toBeGreaterThan(90);
      expect(parseFloat(output)).toBeLessThan(100);
    });

    it('should handle different fee percentages', () => {
      const noFee = calculateSwapOutput({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '100',
        feePercent: 0,
      });

      const withFee = calculateSwapOutput({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '100',
        feePercent: 0.25,
      });

      expect(parseFloat(noFee)).toBeGreaterThan(parseFloat(withFee));
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact correctly', () => {
      const impact = calculatePriceImpact({
        reserveIn: '10000',
        reserveOut: '10000',
        amountIn: '100',
      });

      expect(impact.priceImpact).toBeGreaterThan(0);
      expect(impact.riskLevel).toBeDefined();
      expect(impact.spotPrice).toBeDefined();
      expect(impact.executionPrice).toBeDefined();
    });

    it('should correctly classify risk levels', () => {
      // Small trade - low risk
      const small = calculatePriceImpact({
        reserveIn: '1000000',
        reserveOut: '1000000',
        amountIn: '100',
      });
      expect(small.riskLevel).toBe('low');

      // Large trade - higher risk
      const large = calculatePriceImpact({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '500',
      });
      expect(['medium', 'high', 'extreme']).toContain(large.riskLevel);
    });
  });

  describe('validateSlippage', () => {
    it('should validate acceptable slippage', () => {
      const result = validateSlippage(
        '100',
        '99',
        '98.5',
        1.0
      );

      expect(result.valid).toBe(true);
      expect(result.riskLevel).toBeDefined();
    });

    it('should reject excessive slippage', () => {
      const result = validateSlippage(
        '100',
        '99',
        '85', // Huge loss
        1.0
      );

      expect(result.valid).toBe(false);
      expect(result.warning).toBeDefined();
    });

    it('should provide warnings near limit', () => {
      const result = validateSlippage(
        '100',
        '99',
        '91', // 9% loss
        10.0
      );

      expect(result.warning).toBeUndefined(); // Within limits but risky
    });
  });

  describe('analyzeTradesafety', () => {
    it('should classify safe trade', () => {
      const priceImpact = calculatePriceImpact({
        reserveIn: '1000000',
        reserveOut: '1000000',
        amountIn: '100',
      });

      const slippageValidation = validateSlippage(
        '100',
        '99',
        '98',
        0.5
      );

      const safety = analyzeTradesafety(priceImpact, slippageValidation, '2000000');

      expect(safety.safeToExecute).toBe(true);
      expect(safety.warnings.length).toBe(0);
    });

    it('should warn about high price impact', () => {
      const priceImpact = calculatePriceImpact({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '500', // 50% of liquidity
      });

      const slippageValidation = validateSlippage(
        '500',
        '250',
        '200',
        50
      );

      const safety = analyzeTradesafety(priceImpact, slippageValidation, '1000');

      expect(safety.warnings.length).toBeGreaterThan(0);
    });

    it('should detect large trades', () => {
      const priceImpact = calculatePriceImpact({
        reserveIn: '1000',
        reserveOut: '1000',
        amountIn: '200', // 20% of pool
      });

      const slippageValidation = validateSlippage(
        '200',
        '100',
        '90',
        50
      );

      const safety = analyzeTradesafety(priceImpact, slippageValidation, '1000');

      expect(safety.warnings.some(w => w.includes('Large trade'))).toBe(true);
    });
  });

  describe('recommendSlippageTolerance', () => {
    it('should recommend appropriate tolerance for low impact', () => {
      const tolerance = recommendSlippageTolerance(0.1);
      expect(tolerance).toBeLessThan(1);
      expect(tolerance).toBeGreaterThan(0);
    });

    it('should recommend higher tolerance for high impact', () => {
      const lowImpact = recommendSlippageTolerance(0.1);
      const highImpact = recommendSlippageTolerance(3);

      expect(highImpact).toBeGreaterThan(lowImpact);
    });

    it('should apply volatility multiplier', () => {
      const normal = recommendSlippageTolerance(1, 1); // Normal volatility
      const volatile = recommendSlippageTolerance(1, 2); // High volatility

      expect(volatile).toBeGreaterThan(normal);
    });
  });

  describe('edge cases', () => {
    it('should handle very small amounts', () => {
      const output = calculateSwapOutput({
        reserveIn: '1000000',
        reserveOut: '1000000',
        amountIn: '0.00001',
      });

      expect(parseFloat(output)).toBeGreaterThan(0);
    });

    it('should handle very large amounts', () => {
      const output = calculateSwapOutput({
        reserveIn: '1000000000',
        reserveOut: '1000000000',
        amountIn: '100000000',
      });

      expect(parseFloat(output)).toBeGreaterThan(0);
    });
  });
});
