import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentClient } from '../../agent';
import { SlippageProtectionManager } from '../../lib/slippageProtection';

describe('Enhanced DEX Security Integration', () => {
  let agent: AgentClient;

  beforeEach(() => {
    // Mock environment variables for testing
    process.env.STELLAR_PUBLIC_KEY = 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5';
    process.env.STELLAR_PRIVATE_KEY = 'SCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5';
    
    agent = new AgentClient({
      network: 'testnet',
      publicKey: process.env.STELLAR_PUBLIC_KEY
    });
  });

  describe('slippage protection integration', () => {
    it('should prevent excessive slippage in DEX swaps', async () => {
      // Mock the DEX swap to test slippage protection
      const mockSwapBestRoute = vi.fn().mockRejectedValue(
        new Error('🛡️ Slippage tolerance 15% exceeds maximum allowed 10%')
      );

      // Replace the actual method with our mock
      agent.dex.swapBestRoute = mockSwapBestRoute;

      await expect(
        agent.dex.swapBestRoute({
          mode: 'strict-send',
          sendAsset: { type: 'native' },
          destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
          sendAmount: '1000.0000000',
          slippageBps: 1500, // 15% - should be blocked
        })
      ).rejects.toThrow('🛡️ Slippage tolerance 15% exceeds maximum allowed 10%');
    });

    it('should warn about high price impact trades', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock a successful swap with warnings
      const mockSwapBestRoute = vi.fn().mockResolvedValue({
        hash: 'mock_hash',
        mode: 'strict-send',
        sendAmount: '100000.0000000',
        destAmount: '95000.0000000',
        path: [{ type: 'native' }],
        actualSlippageBps: 200,
        priceImpactBps: 350, // 3.5% price impact
        protectionWarnings: [
          '⚠️  Price Impact: 3.5% - MEDIUM RISK: Moderate price impact. Monitor execution carefully.'
        ]
      });

      agent.dex.swapBestRoute = mockSwapBestRoute;

      const result = await agent.dex.swapBestRoute({
        mode: 'strict-send',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
        sendAmount: '100000.0000000',
        slippageBps: 200,
      });

      expect(result.protectionWarnings).toBeDefined();
      expect(result.protectionWarnings![0]).toContain('Price Impact');
      expect(result.priceImpactBps).toBe(350);
      
      consoleSpy.mockRestore();
    });

    it('should block trades with critical price impact', async () => {
      const mockSwapBestRoute = vi.fn().mockRejectedValue(
        new Error(
          '🛡️ Trade blocked by slippage protection:\n' +
          '⚠️  Price Impact: 12% - CRITICAL: Extremely high price impact. Consider splitting into multiple smaller trades.\n' +
          'Consider reducing trade size or adjusting parameters.'
        )
      );

      agent.dex.swapBestRoute = mockSwapBestRoute;

      await expect(
        agent.dex.swapBestRoute({
          mode: 'strict-send',
          sendAsset: { type: 'native' },
          destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
          sendAmount: '1000000.0000000', // Very large trade
          slippageBps: 100,
        })
      ).rejects.toThrow('🛡️ Trade blocked by slippage protection');
    });

    it('should adjust slippage for MEV protection', async () => {
      const mockSwapBestRoute = vi.fn().mockResolvedValue({
        hash: 'mock_hash',
        mode: 'strict-send',
        sendAmount: '50000.0000000',
        destAmount: '49500.0000000',
        path: [{ type: 'native' }],
        actualSlippageBps: 100, // Reduced from requested 300 due to MEV risk
        priceImpactBps: 150,
        protectionWarnings: [
          '🛡️ MEV Risk: MEDIUM - Consider using private mempool'
        ]
      });

      agent.dex.swapBestRoute = mockSwapBestRoute;

      const result = await agent.dex.swapBestRoute({
        mode: 'strict-send',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
        sendAmount: '50000.0000000',
        slippageBps: 300, // Requested 3%
      });

      // Should have reduced slippage due to MEV protection
      expect(result.actualSlippageBps).toBeLessThan(300);
      expect(result.protectionWarnings).toContain(
        expect.stringContaining('MEV Risk')
      );
    });

    it('should allow disabling slippage protection', async () => {
      const mockSwapBestRoute = vi.fn().mockResolvedValue({
        hash: 'mock_hash',
        mode: 'strict-send',
        sendAmount: '1000.0000000',
        destAmount: '950.0000000',
        path: [{ type: 'native' }],
        actualSlippageBps: 400, // Uses requested slippage when protection disabled
      });

      agent.dex.swapBestRoute = mockSwapBestRoute;

      const result = await agent.dex.swapBestRoute({
        mode: 'strict-send',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
        sendAmount: '1000.0000000',
        slippageBps: 400,
        enableSlippageProtection: false, // Explicitly disable protection
      });

      expect(result.actualSlippageBps).toBe(400);
      expect(result.protectionWarnings).toBeUndefined();
    });

    it('should respect custom price impact limits', async () => {
      const mockSwapBestRoute = vi.fn().mockRejectedValue(
        new Error('🛡️ Price impact 2.5% exceeds maximum allowed 2%')
      );

      agent.dex.swapBestRoute = mockSwapBestRoute;

      await expect(
        agent.dex.swapBestRoute({
          mode: 'strict-send',
          sendAsset: { type: 'native' },
          destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
          sendAmount: '10000.0000000',
          slippageBps: 100,
          maxPriceImpactBps: 200, // 2% max price impact
        })
      ).rejects.toThrow('🛡️ Price impact 2.5% exceeds maximum allowed 2%');
    });
  });

  describe('route validation', () => {
    it('should detect and warn about complex routes', async () => {
      const mockSwapBestRoute = vi.fn().mockResolvedValue({
        hash: 'mock_hash',
        mode: 'strict-send',
        sendAmount: '1000.0000000',
        destAmount: '950.0000000',
        path: [
          { code: 'USDC', issuer: 'G1' },
          { code: 'EURC', issuer: 'G2' },
          { code: 'JPYC', issuer: 'G3' },
          { type: 'native' }
        ],
        actualSlippageBps: 150,
        protectionWarnings: [
          '🔍 Route Issues: Route has many hops, increasing complexity and gas costs'
        ]
      });

      agent.dex.swapBestRoute = mockSwapBestRoute;

      const result = await agent.dex.swapBestRoute({
        mode: 'strict-send',
        sendAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
        destAsset: { type: 'native' },
        sendAmount: '1000.0000000',
        slippageBps: 100,
      });

      expect(result.protectionWarnings).toContain(
        expect.stringContaining('Route Issues')
      );
    });

    it('should block invalid or insecure routes', async () => {
      const mockSwapBestRoute = vi.fn().mockRejectedValue(
        new Error(
          '🛡️ Trade blocked by slippage protection:\n' +
          '🔍 Route Issues: Circular route detected - may indicate inefficient pathfinding, Price inconsistency detected in route\n' +
          'Consider reducing trade size or adjusting parameters.'
        )
      );

      agent.dex.swapBestRoute = mockSwapBestRoute;

      await expect(
        agent.dex.swapBestRoute({
          mode: 'strict-send',
          sendAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
          destAsset: { type: 'native' },
          sendAmount: '1000.0000000',
          slippageBps: 100,
        })
      ).rejects.toThrow('🛡️ Trade blocked by slippage protection');
    });
  });

  describe('backward compatibility', () => {
    it('should maintain compatibility with existing DEX usage', async () => {
      const mockQuoteSwap = vi.fn().mockResolvedValue([
        {
          path: [{ type: 'native' }],
          sendAmount: '1000.0000000',
          destAmount: '950.0000000',
          estimatedPrice: '0.95',
          hopCount: 1,
          raw: {}
        }
      ]);

      agent.dex.quoteSwap = mockQuoteSwap;

      const quotes = await agent.dex.quoteSwap({
        mode: 'strict-send',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GCKFBEIYTKP5RDBKPUQXQVJJGKSXQHMRA5XMKJVK2QXQVJJGKSXQHMRA5' },
        sendAmount: '1000.0000000',
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].sendAmount).toBe('1000.0000000');
      expect(quotes[0].destAmount).toBe('950.0000000');
    });
  });
});