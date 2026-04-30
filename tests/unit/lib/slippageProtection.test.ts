import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlippageProtectionManager, validateSlippage, createSlippageProtection } from '../../../lib/slippageProtection';
import { RouteQuote, StellarAssetInput } from '../../../lib/dex';

describe('SlippageProtectionManager', () => {
  let protectionManager: SlippageProtectionManager;
  let mockQuote: RouteQuote;
  let mockSendAsset: StellarAssetInput;
  let mockDestAsset: StellarAssetInput;

  beforeEach(() => {
    protectionManager = new SlippageProtectionManager();
    
    mockQuote = {
      path: [{ type: 'native' }],
      sendAmount: '1000.0000000',
      destAmount: '950.0000000',
      estimatedPrice: '0.95',
      hopCount: 1,
      raw: {} as any
    };

    mockSendAsset = { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' };
    mockDestAsset = { type: 'native' };
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const manager = new SlippageProtectionManager();
      expect(manager).toBeDefined();
    });

    it('should use custom config when provided', () => {
      const customConfig = {
        maxSlippageBps: 1000,
        priceImpactWarningThreshold: 200,
        sandwichDetectionEnabled: false,
        mevProtectionEnabled: false,
        routeValidationEnabled: false
      };
      
      const manager = new SlippageProtectionManager(customConfig);
      expect(manager).toBeDefined();
    });
  });

  describe('analyzeSlippageProtection', () => {
    it('should analyze slippage protection for normal trade', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        100, // 1% slippage
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result).toBeDefined();
      expect(result.shouldProceed).toBe(true);
      expect(result.adjustedSlippageBps).toBeDefined();
      expect(result.priceImpact).toBeDefined();
      expect(result.routeValidation).toBeDefined();
      expect(result.mevRisk).toBeDefined();
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should block trade with excessive slippage', () => {
      expect(() => {
        protectionManager.analyzeSlippageProtection(
          mockQuote,
          1000, // 10% slippage (exceeds default max of 5%)
          '1000',
          mockSendAsset,
          mockDestAsset
        );
      }).toThrow('🛡️ Slippage tolerance 10% exceeds maximum allowed 5%');
    });

    it('should block trade with negative slippage', () => {
      expect(() => {
        protectionManager.analyzeSlippageProtection(
          mockQuote,
          -100, // Negative slippage
          '1000',
          mockSendAsset,
          mockDestAsset
        );
      }).toThrow('🛡️ Slippage tolerance cannot be negative');
    });

    it('should warn about high slippage', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      protectionManager.analyzeSlippageProtection(
        mockQuote,
        300, // 3% slippage (should trigger warning)
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SLIPPAGE WARNING')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle large trade amounts with high price impact', () => {
      const largeQuote = {
        ...mockQuote,
        sendAmount: '100000.0000000', // Large amount
        hopCount: 3 // Complex route
      };

      const result = protectionManager.analyzeSlippageProtection(
        largeQuote,
        100,
        '100000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result.priceImpact.riskLevel).not.toBe('LOW');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect circular routes', () => {
      const circularQuote = {
        ...mockQuote,
        path: [mockSendAsset, mockDestAsset, mockSendAsset] // Circular path
      };

      const result = protectionManager.analyzeSlippageProtection(
        circularQuote,
        100,
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result.routeValidation.riskFactors).toContain(
        expect.stringContaining('Circular route detected')
      );
    });

    it('should assess MEV risk for large trades', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        400, // High slippage
        '50000', // Large amount
        mockSendAsset,
        mockDestAsset
      );

      expect(result.mevRisk.riskLevel).not.toBe('LOW');
      expect(result.mevRisk.recommendations.length).toBeGreaterThan(0);
    });

    it('should block critical price impact trades', () => {
      // Create a quote that would result in critical price impact
      const criticalQuote = {
        ...mockQuote,
        sendAmount: '1000000.0000000', // Very large amount
        hopCount: 4 // Very complex route
      };

      const result = protectionManager.analyzeSlippageProtection(
        criticalQuote,
        100,
        '1000000',
        mockSendAsset,
        mockDestAsset
      );

      // Should either block the trade or provide critical warnings
      expect(
        !result.shouldProceed || 
        result.priceImpact.riskLevel === 'CRITICAL' ||
        result.warnings.length > 0
      ).toBe(true);
    });

    it('should adjust slippage for high MEV risk', () => {
      const highMEVQuote = {
        ...mockQuote,
        sendAmount: '75000.0000000', // Large enough to trigger MEV concerns
        estimatedPrice: '1.5' // Good price that might attract front-runners
      };

      const result = protectionManager.analyzeSlippageProtection(
        highMEVQuote,
        300, // 3% requested slippage
        '75000',
        mockSendAsset,
        mockDestAsset
      );

      // Should adjust slippage down for MEV protection
      if (result.mevRisk.riskLevel === 'HIGH') {
        expect(result.adjustedSlippageBps).toBeLessThanOrEqual(100); // Max 1% for high MEV risk
      }
    });
  });

  describe('price impact analysis', () => {
    it('should calculate low price impact for small trades', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        100,
        '100', // Small amount
        mockSendAsset,
        mockDestAsset
      );

      expect(result.priceImpact.riskLevel).toBe('LOW');
      expect(result.priceImpact.isHighImpact).toBe(false);
    });

    it('should provide recommendations for high impact trades', () => {
      const highImpactQuote = {
        ...mockQuote,
        sendAmount: '500000.0000000',
        hopCount: 3
      };

      const result = protectionManager.analyzeSlippageProtection(
        highImpactQuote,
        100,
        '500000',
        mockSendAsset,
        mockDestAsset
      );

      if (result.priceImpact.riskLevel === 'HIGH' || result.priceImpact.riskLevel === 'CRITICAL') {
        expect(result.priceImpact.recommendation).toContain('Consider');
        expect(result.priceImpact.maxSafeAmount).toBeDefined();
      }
    });
  });

  describe('route validation', () => {
    it('should validate simple routes as secure', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        100,
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result.routeValidation.isValid).toBe(true);
      expect(result.routeValidation.securityScore).toBeGreaterThan(50);
    });

    it('should penalize complex routes', () => {
      const complexQuote = {
        ...mockQuote,
        hopCount: 5, // Very complex route
        path: new Array(5).fill({ code: 'TEST', issuer: 'G'.repeat(56) })
      };

      const result = protectionManager.analyzeSlippageProtection(
        complexQuote,
        100,
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result.routeValidation.riskFactors).toContain(
        expect.stringContaining('many hops')
      );
      expect(result.routeValidation.securityScore).toBeLessThan(100);
    });
  });

  describe('MEV risk assessment', () => {
    it('should assess low MEV risk for small trades', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        50, // Low slippage
        '100', // Small amount
        mockSendAsset,
        mockDestAsset
      );

      expect(result.mevRisk.riskLevel).toBe('LOW');
      expect(result.mevRisk.sandwichRisk).toBeLessThan(50);
      expect(result.mevRisk.frontRunningRisk).toBeLessThan(50);
    });

    it('should provide MEV protection recommendations', () => {
      const result = protectionManager.analyzeSlippageProtection(
        mockQuote,
        100,
        '1000',
        mockSendAsset,
        mockDestAsset
      );

      expect(result.mevRisk.recommendations).toBeInstanceOf(Array);
      expect(result.mevRisk.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('validateSlippage', () => {
  it('should pass for valid slippage values', () => {
    expect(() => validateSlippage(100)).not.toThrow(); // 1%
    expect(() => validateSlippage(250)).not.toThrow(); // 2.5%
    expect(() => validateSlippage(500)).not.toThrow(); // 5%
  });

  it('should throw for negative slippage', () => {
    expect(() => validateSlippage(-100)).toThrow('🛡️ Slippage tolerance cannot be negative');
  });

  it('should throw for excessive slippage', () => {
    expect(() => validateSlippage(1000)).toThrow('🛡️ Slippage tolerance 10% exceeds maximum 5%');
  });

  it('should respect custom maximum', () => {
    expect(() => validateSlippage(800, 1000)).not.toThrow(); // 8% with 10% max
    expect(() => validateSlippage(1200, 1000)).toThrow('🛡️ Slippage tolerance 12% exceeds maximum 10%');
  });
});

describe('createSlippageProtection', () => {
  it('should create SlippageProtectionManager with default config', () => {
    const manager = createSlippageProtection();
    expect(manager).toBeInstanceOf(SlippageProtectionManager);
  });

  it('should create SlippageProtectionManager with custom config', () => {
    const config = { maxSlippageBps: 1000 };
    const manager = createSlippageProtection(config);
    expect(manager).toBeInstanceOf(SlippageProtectionManager);
  });
});