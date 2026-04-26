/**
 * Route Optimizer Tests
 * 
 * Comprehensive test suite for the route optimizer functionality
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { RouteOptimizer, SwapStrategy } from '../lib/routeOptimizer';
import type { OptimizedSwapParams, PoolInfo, RouteOption } from '../lib/routeOptimizer';

// Mock Horizon server
const mockHorizonServer = {
  liquidityPools: vi.fn(),
  loadAccount: vi.fn(),
  submitTransaction: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn() as Mock;

describe('RouteOptimizer', () => {
  let routeOptimizer: RouteOptimizer;
  let mockFetch: Mock;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    routeOptimizer = new RouteOptimizer({
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      maxHops: 3,
      maxRoutes: 5,
      cacheTimeout: 10
    });

    mockFetch = global.fetch as Mock;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const optimizer = new RouteOptimizer({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org'
      });

      expect(optimizer).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const optimizer = new RouteOptimizer({
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        maxHops: 5,
        maxRoutes: 20,
        cacheTimeout: 60
      });

      expect(optimizer).toBeDefined();
    });
  });

  describe('pool querying', () => {
    it('should query Horizon pools successfully', async () => {
      const mockPoolsResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              reserves: [
                { asset: { asset_type: 'native' }, amount: '1000000' },
                { asset: { asset_code: 'USDC', asset_issuer: 'GB...' }, amount: '500000' }
              ],
              total_poolshares: '1000',
              fee_bp: 30
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPoolsResponse
      });

      // Access private method through reflection for testing
      const pools = await (routeOptimizer as any).queryHorizonPools();

      expect(pools).toHaveLength(1);
      expect(pools[0].id).toBe('pool1');
      expect(pools[0].assetA).toEqual({ type: 'native' });
      expect(pools[0].assetB).toEqual({ code: 'USDC', issuer: 'GB...' });
      expect(pools[0].fee).toBe(0.003);
    });

    it('should handle Horizon API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const pools = await (routeOptimizer as any).queryHorizonPools();

      expect(pools).toEqual([]);
    });

    it('should cache pool responses', async () => {
      const mockPoolsResponse = {
        _embedded: { records: [] }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPoolsResponse
      });

      // First call should make API request
      await (routeOptimizer as any).queryPools();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await (routeOptimizer as any).queryPools();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('route calculation', () => {
    const mockPools: PoolInfo[] = [
      {
        id: 'pool1',
        assetA: { type: 'native' },
        assetB: { code: 'USDC', issuer: 'GB...' },
        reserveA: '1000000',
        reserveB: '500000',
        fee: 0.003,
        type: 'constant_product'
      },
      {
        id: 'pool2',
        assetA: { code: 'USDC', issuer: 'GB...' },
        assetB: { code: 'ETH', issuer: 'GB2...' },
        reserveA: '200000',
        reserveB: '100',
        fee: 0.003,
        type: 'constant_product'
      }
    ];

    it('should find direct routes', async () => {
      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100'
      };

      const routes = await (routeOptimizer as any).calculateRoutes(params, mockPools);

      expect(routes).toHaveLength(1);
      expect(routes[0].hopCount).toBe(1);
      expect(routes[0].pools).toHaveLength(1);
      expect(routes[0].pools[0].id).toBe('pool1');
    });

    it('should find multi-hop routes', async () => {
      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'ETH', issuer: 'GB2...' },
        sendAmount: '100',
        maxHops: 3
      };

      const routes = await (routeOptimizer as any).calculateRoutes(params, mockPools);

      expect(routes.length).toBeGreaterThan(0);
      
      // Should have a 2-hop route
      const multiHopRoute = routes.find((r: any) => r.hopCount === 2);
      expect(multiHopRoute).toBeDefined();
      expect(multiHopRoute!.pools).toHaveLength(2);
    });

    it('should respect max hops limit', async () => {
      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'ETH', issuer: 'GB2...' },
        sendAmount: '100',
        maxHops: 1
      };

      const routes = await (routeOptimizer as any).calculateRoutes(params, mockPools);

      // Should only find direct routes or none
      expect(routes.every((r: any) => r.hopCount <= 1)).toBe(true);
    });

    it('should filter pools based on preferences', async () => {
      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100',
        excludePools: ['pool1']
      };

      const routes = await (routeOptimizer as any).calculateRoutes(params, mockPools);

      expect(routes).toHaveLength(0); // pool1 was excluded
    });
  });

  describe('strategy selection', () => {
    const mockRoutes: RouteOption[] = [
      {
        path: [{ type: 'native' }, { code: 'USDC', issuer: 'GB...' }],
        pools: [{ id: 'pool1', assetA: { type: 'native' }, assetB: { code: 'USDC', issuer: 'GB...' }, reserveA: '1000', reserveB: '500', fee: 0.003, type: 'constant_product' }],
        inputAmount: '100',
        outputAmount: '49.85',
        priceImpact: '0.3',
        hopCount: 1,
        totalFee: '0.15',
        estimatedGas: '100000',
        confidence: 0.95
      },
      {
        path: [{ type: 'native' }, { code: 'USDC', issuer: 'GB...' }, { code: 'ETH', issuer: 'GB2...' }],
        pools: [
          { id: 'pool1', assetA: { type: 'native' }, assetB: { code: 'USDC', issuer: 'GB...' }, reserveA: '1000', reserveB: '500', fee: 0.003, type: 'constant_product' },
          { id: 'pool2', assetA: { code: 'USDC', issuer: 'GB...' }, assetB: { code: 'ETH', issuer: 'GB2...' }, reserveA: '500', reserveB: '0.1', fee: 0.003, type: 'constant_product' }
        ],
        inputAmount: '100',
        outputAmount: '0.025',
        priceImpact: '1.2',
        hopCount: 2,
        totalFee: '0.30',
        estimatedGas: '200000',
        confidence: 0.85
      }
    ];

    it('should select best route strategy', () => {
      const bestRoute = (routeOptimizer as any).selectBestRoute(mockRoutes);

      expect(bestRoute.outputAmount).toBe('49.85'); // Higher output amount
      expect(bestRoute.hopCount).toBe(1); // Fewer hops
    });

    it('should select direct route strategy', () => {
      const directRoute = (routeOptimizer as any).selectDirectRoute(mockRoutes);

      expect(directRoute.hopCount).toBe(1);
    });

    it('should select minimal hops strategy', () => {
      const minimalRoute = (routeOptimizer as any).selectMinimalHopsRoute(mockRoutes);

      expect(minimalRoute.hopCount).toBe(1);
    });

    it('should handle no available routes', () => {
      expect(() => {
        (routeOptimizer as any).selectBestRoute([]);
      }).toThrow('No routes available for this swap');
    });
  });

  describe('route metrics calculation', () => {
    it('should calculate price impact correctly', () => {
      const route: RouteOption = {
        path: [{ type: 'native' }, { code: 'USDC', issuer: 'GB...' }],
        pools: [{ 
          id: 'pool1', 
          assetA: { type: 'native' }, 
          assetB: { code: 'USDC', issuer: 'GB...' }, 
          reserveA: '1000000', 
          reserveB: '500000', 
          fee: 0.003, 
          type: 'constant_product' 
        }],
        inputAmount: '1000',
        outputAmount: '498.5',
        priceImpact: '0',
        hopCount: 1,
        totalFee: '1.5',
        estimatedGas: '100000',
        confidence: 1.0
      };

      const calculatedRoute = (routeOptimizer as any).calculateRouteMetrics(route);

      expect(parseFloat(calculatedRoute.priceImpact)).toBeCloseTo(0.067, 2); // ~0.067% impact
    });

    it('should calculate confidence score correctly', () => {
      const highConfidenceRoute: RouteOption = {
        path: [{ type: 'native' }, { code: 'USDC', issuer: 'GB...' }],
        pools: [{ 
          id: 'pool1', 
          assetA: { type: 'native' }, 
          assetB: { code: 'USDC', issuer: 'GB...' }, 
          reserveA: '1000000', 
          reserveB: '500000', 
          fee: 0.003, 
          type: 'constant_product' 
        }],
        inputAmount: '100',
        outputAmount: '49.85',
        priceImpact: '0.3',
        hopCount: 1,
        totalFee: '0.15',
        estimatedGas: '100000',
        confidence: 1.0
      };

      const calculatedRoute = (routeOptimizer as any).calculateRouteMetrics(highConfidenceRoute);

      expect(calculatedRoute.confidence).toBeGreaterThan(0.9);
    });

    it('should reduce confidence for complex routes', () => {
      const complexRoute: RouteOption = {
        path: [{ type: 'native' }, { code: 'USDC', issuer: 'GB...' }, { code: 'ETH', issuer: 'GB2...' }, { code: 'BTC', issuer: 'GB3...' }],
        pools: [
          { id: 'pool1', assetA: { type: 'native' }, assetB: { code: 'USDC', issuer: 'GB...' }, reserveA: '1000', reserveB: '500', fee: 0.003, type: 'constant_product' },
          { id: 'pool2', assetA: { code: 'USDC', issuer: 'GB...' }, assetB: { code: 'ETH', issuer: 'GB2...' }, reserveA: '500', reserveB: '0.1', fee: 0.003, type: 'constant_product' },
          { id: 'pool3', assetA: { code: 'ETH', issuer: 'GB2...' }, assetB: { code: 'BTC', issuer: 'GB3...' }, reserveA: '0.1', reserveB: '0.001', fee: 0.003, type: 'constant_product' }
        ],
        inputAmount: '100',
        outputAmount: '0.00001',
        priceImpact: '15.0',
        hopCount: 3,
        totalFee: '0.45',
        estimatedGas: '300000',
        confidence: 1.0
      };

      const calculatedRoute = (routeOptimizer as any).calculateRouteMetrics(complexRoute);

      expect(calculatedRoute.confidence).toBeLessThan(0.8); // Should be lower due to complexity
    });
  });

  describe('swap output estimation', () => {
    it('should estimate constant product swap output correctly', () => {
      const pool: PoolInfo = {
        id: 'pool1',
        assetA: { type: 'native' },
        assetB: { code: 'USDC', issuer: 'GB...' },
        reserveA: '1000000',
        reserveB: '500000',
        fee: 0.003,
        type: 'constant_product'
      };

      const output = (routeOptimizer as any).estimateSwapOutput(pool, '1000', { type: 'native' });

      // Using constant product formula: x * y = k
      // With 0.3% fee, expected output should be close to 498.5 USDC
      expect(parseFloat(output)).toBeCloseTo(498.5, 0);
    });

    it('should handle zero input amount', () => {
      const pool: PoolInfo = {
        id: 'pool1',
        assetA: { type: 'native' },
        assetB: { code: 'USDC', issuer: 'GB...' },
        reserveA: '1000000',
        reserveB: '500000',
        fee: 0.003,
        type: 'constant_product'
      };

      const output = (routeOptimizer as any).estimateSwapOutput(pool, '0', { type: 'native' });

      expect(output).toBe('0.0000000');
    });
  });

  describe('integration tests', () => {
    it('should execute complete optimized swap flow', async () => {
      const mockPoolsResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              reserves: [
                { asset: { asset_type: 'native' }, amount: '1000000' },
                { asset: { asset_code: 'USDC', asset_issuer: 'GB...' }, amount: '500000' }
              ],
              total_poolshares: '1000',
              fee_bp: 30
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPoolsResponse
      });

      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100',
        slippageBps: 100
      };

      const route = await routeOptimizer.findOptimalRoute(params);

      expect(route).toBeDefined();
      expect(route.hopCount).toBe(1);
      expect(route.inputAmount).toBe('100');
      expect(parseFloat(route.outputAmount)).toBeGreaterThan(0);
    });

    it('should handle unsupported asset pairs gracefully', async () => {
      const mockPoolsResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              reserves: [
                { asset: { asset_type: 'native' }, amount: '1000000' },
                { asset: { asset_code: 'USDC', asset_issuer: 'GB...' }, amount: '500000' }
              ],
              total_poolshares: '1000',
              fee_bp: 30
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPoolsResponse
      });

      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { code: 'BTC', issuer: 'GBBTC...' },
        destAsset: { code: 'ETH', issuer: 'GBETH...' },
        sendAmount: '1'
      };

      await expect(routeOptimizer.findOptimalRoute(params)).rejects.toThrow('No routes available');
    });

    it('should respect strategy preferences', async () => {
      const mockPoolsResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              reserves: [
                { asset: { asset_type: 'native' }, amount: '1000000' },
                { asset: { asset_code: 'USDC', asset_issuer: 'GB...' }, amount: '500000' }
              ],
              total_poolshares: '1000',
              fee_bp: 30
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPoolsResponse
      });

      const strategies: SwapStrategy[] = ['best-route', 'direct', 'minimal-hops'];
      
      for (const strategy of strategies) {
        const params: OptimizedSwapParams = {
          strategy,
          sendAsset: { type: 'native' },
          destAsset: { code: 'USDC', issuer: 'GB...' },
          sendAmount: '100'
        };

        const route = await routeOptimizer.findOptimalRoute(params);
        expect(route).toBeDefined();
        expect(route.hopCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));

      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100'
      };

      await expect(routeOptimizer.findOptimalRoute(params)).rejects.toThrow();
    });

    it('should handle invalid parameters', async () => {
      const invalidParams: OptimizedSwapParams = {
        strategy: 'invalid-strategy' as SwapStrategy,
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100'
      };

      await expect(routeOptimizer.findOptimalRoute(invalidParams)).rejects.toThrow('Unknown strategy');
    });

    it('should handle malformed pool data', async () => {
      const malformedResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              // Missing required fields
              reserves: [],
              total_poolshares: '0'
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => malformedResponse
      });

      const params: OptimizedSwapParams = {
        strategy: 'best-route',
        sendAsset: { type: 'native' },
        destAsset: { code: 'USDC', issuer: 'GB...' },
        sendAmount: '100'
      };

      await expect(routeOptimizer.findOptimalRoute(params)).rejects.toThrow('No routes available');
    });
  });
});
