/**
 * Tests for Analytics functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsManager } from '../lib/analyticsManager';
import type { TransactionMetrics, PerformanceSummary } from '../lib/analytics';

describe('AnalyticsManager', () => {
  let analytics: AnalyticsManager;

  beforeEach(() => {
    // Create a fresh analytics manager for each test
    analytics = new AnalyticsManager({
      enablePersistence: false, // Disable persistence for tests
      maxRecords: 100,
      retentionDays: 30
    });
  });

  describe('Transaction Tracking', () => {
    it('should start a new transaction', () => {
      const transactionId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });

      expect(transactionId).toBeDefined();
      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
    });

    it('should complete a transaction successfully', () => {
      const transactionId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });

      const result = { hash: 'test_hash_123' };
      const executionTime = 1500;

      analytics.completeTransaction(transactionId, result, executionTime);

      const transactions = analytics.getTransactions();
      const transaction = transactions.find(t => t.id === transactionId);

      expect(transaction).toBeDefined();
      expect(transaction!.status).toBe('success');
      expect(transaction!.executionTime).toBe(executionTime);
      expect(transaction!.hash).toBe(result.hash);
    });

    it('should mark a transaction as failed', () => {
      const transactionId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });

      const error = new Error('Insufficient funds');

      analytics.failTransaction(transactionId, error);

      const transactions = analytics.getTransactions();
      const transaction = transactions.find(t => t.id === transactionId);

      expect(transaction).toBeDefined();
      expect(transaction!.status).toBe('failed');
      expect(transaction!.error).toBeDefined();
      expect(transaction!.error!.message).toBe('Insufficient funds');
    });

    it('should handle different transaction types', () => {
      // Test swap
      const swapId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });
      analytics.completeTransaction(swapId, { hash: 'swap_hash' }, 1000);

      // Test bridge
      const bridgeId = analytics.startTransaction('bridge', {
        fromNetwork: 'stellar-testnet',
        toNetwork: 'ethereum',
        amount: '100',
        asset: 'USDC',
        targetAddress: '0x123...'
      });
      analytics.completeTransaction(bridgeId, { hash: 'bridge_hash' }, 2000);

      // Test LP deposit
      const depositId = analytics.startTransaction('lp_deposit', {
        poolAddress: 'pool_123',
        tokenA: 'USDC',
        tokenB: 'XLM',
        amountA: '500',
        amountB: '1000'
      });
      analytics.completeTransaction(depositId, { hash: 'deposit_hash' }, 1500);

      const transactions = analytics.getTransactions();
      expect(transactions).toHaveLength(3);

      const swapTx = transactions.find(t => t.id === swapId);
      const bridgeTx = transactions.find(t => t.id === bridgeId);
      const depositTx = transactions.find(t => t.id === depositId);

      expect(swapTx?.type).toBe('swap');
      expect(swapTx?.swapData?.inputAsset).toBe('USDC');
      
      expect(bridgeTx?.type).toBe('bridge');
      expect(bridgeTx?.bridgeData?.fromNetwork).toBe('stellar-testnet');
      
      expect(depositTx?.type).toBe('lp_deposit');
      expect(depositTx?.lpData?.tokenA).toBe('USDC');
    });
  });

  describe('Performance Summary', () => {
    it('should generate correct performance summary', () => {
      // Add some test transactions
      const tx1 = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });
      analytics.completeTransaction(tx1, { hash: 'hash1' }, 1000);

      const tx2 = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '2000',
        outputAmount: '10000'
      });
      analytics.completeTransaction(tx2, { hash: 'hash2' }, 1500);

      const tx3 = analytics.startTransaction('bridge', {
        fromNetwork: 'stellar-testnet',
        toNetwork: 'ethereum',
        amount: '100',
        asset: 'USDC',
        targetAddress: '0x123...'
      });
      analytics.failTransaction(tx3, new Error('Network error'));

      const summary = analytics.getSummary();

      expect(summary.totalTransactions).toBe(3);
      expect(summary.successfulTransactions).toBe(2);
      expect(summary.failedTransactions).toBe(1);
      expect(summary.successRate).toBe('66.67%');
      expect(summary.totalVolume).toBe('3000'); // 1000 + 2000
      expect(summary.averageExecutionTime).toBe(1250); // (1000 + 1500) / 2
    });

    it('should calculate swap-specific metrics', () => {
      // Add swaps with slippage data
      const tx1 = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000',
        slippage: '1.5'
      });
      analytics.completeTransaction(tx1, { hash: 'hash1', actualOutput: '4925' }, 1000);

      const tx2 = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '2000',
        outputAmount: '10000',
        slippage: '0.8'
      });
      analytics.completeTransaction(tx2, { hash: 'hash2', actualOutput: '9920' }, 1500);

      const summary = analytics.getSummary();

      expect(summary.swapMetrics).toBeDefined();
      expect(summary.swapMetrics!.totalSwaps).toBe(2);
      expect(summary.swapMetrics!.totalSwapVolume).toBe('3000');
      expect(summary.swapMetrics!.averageSlippage).toBe('1.15%'); // (1.5 + 0.8) / 2
      expect(summary.swapMetrics!.bestSlippage).toBe('0.80%');
      expect(summary.swapMetrics!.worstSlippage).toBe('1.50%');
    });

    it('should calculate bridge-specific metrics', () => {
      // Add bridge transactions
      const tx1 = analytics.startTransaction('bridge', {
        fromNetwork: 'stellar-testnet',
        toNetwork: 'ethereum',
        amount: '100',
        asset: 'USDC',
        targetAddress: '0x123...',
        bridgeFee: '2.5'
      });
      analytics.completeTransaction(tx1, { hash: 'hash1' }, 2000);

      const tx2 = analytics.startTransaction('bridge', {
        fromNetwork: 'stellar-testnet',
        toNetwork: 'polygon',
        amount: '200',
        asset: 'USDC',
        targetAddress: '0x456...',
        bridgeFee: '1.8'
      });
      analytics.completeTransaction(tx2, { hash: 'hash2' }, 2500);

      const summary = analytics.getSummary();

      expect(summary.bridgeMetrics).toBeDefined();
      expect(summary.bridgeMetrics!.totalBridges).toBe(2);
      expect(summary.bridgeMetrics!.totalBridgeVolume).toBe('300');
      expect(summary.bridgeMetrics!.averageBridgeFee).toBe('4.3'); // 2.5 + 1.8
      expect(summary.bridgeMetrics!.mostUsedTargetChain).toBe('ethereum'); // Both appear once, first in array
    });
  });

  describe('Filtering and Querying', () => {
    beforeEach(() => {
      // Add test data for filtering tests
      const now = Date.now();
      
      // Add successful swap
      const swapId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });
      analytics.completeTransaction(swapId, { hash: 'swap_hash' }, 1000);

      // Add failed bridge
      const bridgeId = analytics.startTransaction('bridge', {
        fromNetwork: 'stellar-testnet',
        toNetwork: 'ethereum',
        amount: '100',
        asset: 'USDC',
        targetAddress: '0x123...'
      });
      analytics.failTransaction(bridgeId, new Error('Network error'));

      // Add successful LP deposit
      const depositId = analytics.startTransaction('lp_deposit', {
        poolAddress: 'pool_123',
        tokenA: 'USDC',
        tokenB: 'XLM',
        amountA: '500',
        amountB: '1000'
      });
      analytics.completeTransaction(depositId, { hash: 'deposit_hash' }, 1500);
    });

    it('should filter by transaction type', () => {
      const swaps = analytics.getTransactions({ type: 'swap' });
      const bridges = analytics.getTransactions({ type: 'bridge' });
      const deposits = analytics.getTransactions({ type: 'lp_deposit' });

      expect(swaps).toHaveLength(1);
      expect(bridges).toHaveLength(1);
      expect(deposits).toHaveLength(1);

      expect(swaps[0].type).toBe('swap');
      expect(bridges[0].type).toBe('bridge');
      expect(deposits[0].type).toBe('lp_deposit');
    });

    it('should filter by status', () => {
      const successful = analytics.getTransactions({ status: 'success' });
      const failed = analytics.getTransactions({ status: 'failed' });

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);

      expect(successful.every(tx => tx.status === 'success')).toBe(true);
      expect(failed.every(tx => tx.status === 'failed')).toBe(true);
    });

    it('should filter by asset', () => {
      const usdcTransactions = analytics.getTransactions({ asset: 'USDC' });
      
      // Should find swap (USDC->XLM), bridge (USDC), and deposit (USDC/XLM)
      expect(usdcTransactions.length).toBeGreaterThan(0);
      expect(usdcTransactions.every(tx => {
        const assets = [];
        if (tx.swapData) {
          assets.push(tx.swapData.inputAsset, tx.swapData.outputAsset);
        }
        if (tx.bridgeData) {
          assets.push(tx.bridgeData.asset);
        }
        if (tx.lpData) {
          assets.push(tx.lpData.tokenA, tx.lpData.tokenB);
        }
        return assets.includes('USDC');
      })).toBe(true);
    });

    it('should limit results', () => {
      const limited = analytics.getTransactions({ limit: 2 });
      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Detailed Analytics', () => {
    beforeEach(() => {
      // Add test data for detailed analytics
      for (let i = 0; i < 10; i++) {
        const txId = analytics.startTransaction('swap', {
          inputAsset: 'USDC',
          outputAsset: 'XLM',
          inputAmount: (1000 + i * 100).toString(),
          outputAmount: (5000 + i * 500).toString(),
          slippage: (1 + i * 0.1).toString()
        });
        analytics.completeTransaction(txId, { hash: `hash_${i}` }, 1000 + i * 100);
      }
    });

    it('should generate detailed analytics', () => {
      const detailed = analytics.getDetailedAnalytics();

      expect(detailed.summary).toBeDefined();
      expect(detailed.recentTransactions).toBeDefined();
      expect(detailed.hourlyVolume).toBeDefined();
      expect(detailed.assetPerformance).toBeDefined();
      expect(detailed.errorAnalysis).toBeDefined();

      expect(detailed.recentTransactions.length).toBeGreaterThan(0);
      expect(detailed.hourlyVolume.length).toBe(24); // Should have 24 hours
      expect(detailed.assetPerformance.length).toBeGreaterThan(0);
    });

    it('should calculate hourly volume correctly', () => {
      const detailed = analytics.getDetailedAnalytics();
      const currentHour = new Date().getHours();
      
      const currentHourData = detailed.hourlyVolume.find(h => h.hour === currentHour);
      expect(currentHourData).toBeDefined();
      expect(parseInt(currentHourData!.volume)).toBeGreaterThan(0);
      expect(currentHourData!.transactionCount).toBeGreaterThan(0);
    });

    it('should analyze asset performance', () => {
      const detailed = analytics.getDetailedAnalytics();
      const usdcPerformance = detailed.assetPerformance.find(a => a.asset === 'USDC');
      
      expect(usdcPerformance).toBeDefined();
      expect(parseInt(usdcPerformance!.totalVolume)).toBeGreaterThan(0);
      expect(usdcPerformance!.transactionCount).toBeGreaterThan(0);
    });
  });

  describe('Data Management', () => {
    it('should export data correctly', () => {
      // Add some test data
      const txId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });
      analytics.completeTransaction(txId, { hash: 'test_hash' }, 1000);

      const exportData = analytics.exportData();
      const parsed = JSON.parse(exportData);

      expect(parsed.transactions).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();

      expect(parsed.transactions.length).toBe(1);
      expect(parsed.transactions[0].id).toBe(txId);
    });

    it('should cleanup old data', () => {
      // Add some test data
      const txId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });
      analytics.completeTransaction(txId, { hash: 'test_hash' }, 1000);

      expect(analytics.getTransactions().length).toBe(1);

      // Cleanup should not remove recent data
      analytics.cleanup();
      expect(analytics.getTransactions().length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid transaction IDs gracefully', () => {
      // Try to complete a transaction that doesn't exist
      expect(() => {
        analytics.completeTransaction('invalid_id', { hash: 'test' }, 1000);
      }).not.toThrow();

      // Try to fail a transaction that doesn't exist
      expect(() => {
        analytics.failTransaction('invalid_id', new Error('Test error'));
      }).not.toThrow();
    });

    it('should handle malformed error objects', () => {
      const txId = analytics.startTransaction('swap', {
        inputAsset: 'USDC',
        outputAsset: 'XLM',
        inputAmount: '1000',
        outputAmount: '5000'
      });

      // Fail with string error
      analytics.failTransaction(txId, 'String error message');
      
      const transaction = analytics.getTransactions().find(t => t.id === txId);
      expect(transaction?.error?.message).toBe('String error message');
    });
  });
});
