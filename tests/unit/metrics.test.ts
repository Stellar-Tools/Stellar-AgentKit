import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsCollector, type TransactionMetrics } from '../../lib/metrics';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  const testNetwork = 'testnet';
  const testDataDir = join(homedir(), '.stellartools-test'); // Use isolated test directory

  beforeEach(() => {
    // Clean up any existing test metrics file
    const testMetricsFile = join(testDataDir, `metrics-${testNetwork}.json`);
    if (existsSync(testMetricsFile)) {
      unlinkSync(testMetricsFile);
    }
    
    // Create the test directory if it doesn't exist
    if (!existsSync(testDataDir)) {
      writeFileSync(testDataDir, ''); // Create directory marker
    }
    
    // Create a mock MetricsCollector that uses the test directory
    metricsCollector = new MetricsCollector(testNetwork as any);
    
    // Override the metrics file path to use test directory BEFORE any operations
    (metricsCollector as any).metricsFile = testMetricsFile;
    
    // Clear any existing metrics to ensure clean test state
    metricsCollector.clearMetrics();
  });

  afterEach(() => {
    // Clean up test metrics file after each test
    const testMetricsFile = join(testDataDir, `metrics-${testNetwork}.json`);
    if (existsSync(testMetricsFile)) {
      unlinkSync(testMetricsFile);
    }
  });

  describe('recordTransaction', () => {
    it('should record a transaction successfully', () => {
      const metricId = metricsCollector.recordTransaction({
        type: 'swap',
        status: 'pending',
        amount: '100',
        toAddress: 'GD...TEST',
        fromAddress: 'GB...TEST',
      });

      expect(metricId).toMatch(/^tx_\d+_[a-z0-9]+$/);
      
      const transactions = metricsCollector.getTransactions();
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: 'swap',
        status: 'pending',
        amount: '100',
        toAddress: 'GD...TEST',
        fromAddress: 'GB...TEST',
      });
      expect(transactions[0].id).toBe(metricId);
      expect(transactions[0].timestamp).toBeTypeOf('number');
    });

    it('should record different transaction types', () => {
      const swapId = metricsCollector.recordTransaction({
        type: 'swap',
        status: 'success',
        amount: '50',
        executionTime: 1000,
      });

      const bridgeId = metricsCollector.recordTransaction({
        type: 'bridge',
        status: 'success',
        amount: '100',
        targetChain: 'ethereum',
        asset: 'USDC',
      });

      const transactions = metricsCollector.getTransactions();
      expect(transactions).toHaveLength(2);
      
      const swapTx = transactions.find(t => t.id === swapId);
      const bridgeTx = transactions.find(t => t.id === bridgeId);
      
      expect(swapTx?.type).toBe('swap');
      expect(bridgeTx?.type).toBe('bridge');
      expect(bridgeTx?.targetChain).toBe('ethereum');
      expect(bridgeTx?.asset).toBe('USDC');
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status and additional data', () => {
      const metricId = metricsCollector.recordTransaction({
        type: 'swap',
        status: 'pending',
        amount: '100',
      });

      metricsCollector.updateTransactionStatus(metricId, 'success', {
        executionTime: 1500,
        transactionHash: '0x123...abc',
        gasUsed: '1000',
      });

      const transactions = metricsCollector.getTransactions();
      const transaction = transactions.find(t => t.id === metricId);
      
      expect(transaction?.status).toBe('success');
      expect(transaction?.executionTime).toBe(1500);
      expect(transaction?.transactionHash).toBe('0x123...abc');
      expect(transaction?.gasUsed).toBe('1000');
    });

    it('should handle updating non-existent transaction gracefully', () => {
      const nonExistentId = 'tx_nonexistent';
      
      expect(() => {
        metricsCollector.updateTransactionStatus(nonExistentId, 'success');
      }).not.toThrow();
      
      const transactions = metricsCollector.getTransactions();
      expect(transactions).toHaveLength(0);
    });
  });

  describe('getTransactions', () => {
    beforeEach(() => {
      // Create test transactions with different timestamps
      const baseTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordTransaction({
          type: i % 2 === 0 ? 'swap' : 'bridge',
          status: 'success',
          amount: (100 * (i + 1)).toString(),
        });
        
        // Add small delay to ensure different timestamps
        if (i < 4) {
          // Simulate time passing
          const currentMetrics = metricsCollector.getTransactions();
          currentMetrics[currentMetrics.length - 1].timestamp = baseTime + (i * 1000);
        }
      }
    });

    it('should return transactions sorted by newest first', () => {
      const transactions = metricsCollector.getTransactions();
      expect(transactions).toHaveLength(5);
      
      // Check that transactions are sorted by timestamp (newest first)
      for (let i = 0; i < transactions.length - 1; i++) {
        expect(transactions[i].timestamp).toBeGreaterThanOrEqual(transactions[i + 1].timestamp);
      }
    });

    it('should limit number of transactions when specified', () => {
      const transactions = metricsCollector.getTransactions(3);
      expect(transactions).toHaveLength(3);
    });

    it('should filter by transaction type', () => {
      const swapTransactions = metricsCollector.getTransactions(undefined, 'swap');
      const bridgeTransactions = metricsCollector.getTransactions(undefined, 'bridge');
      
      expect(swapTransactions).toHaveLength(3);
      expect(bridgeTransactions).toHaveLength(2);
      
      swapTransactions.forEach(tx => expect(tx.type).toBe('swap'));
      bridgeTransactions.forEach(tx => expect(tx.type).toBe('bridge'));
    });
  });

  describe('calculateSummary', () => {
    beforeEach(() => {
      // Clear any existing metrics first
      metricsCollector.clearMetrics();
      
      // Create test data for summary calculation
      const transactions = [
        { type: 'swap' as const, status: 'success' as const, amount: '100', executionTime: 1000 },
        { type: 'swap' as const, status: 'success' as const, amount: '200', executionTime: 1500 },
        { type: 'bridge' as const, status: 'success' as const, amount: '300', executionTime: 2000 },
        { type: 'deposit' as const, status: 'failed' as const, amount: '150', executionTime: 500 },
        { type: 'withdraw' as const, status: 'pending' as const, amount: '100', executionTime: 1200 },
      ];

      transactions.forEach(tx => {
        metricsCollector.recordTransaction(tx);
      });
    });

    it('should calculate correct summary statistics', () => {
      const summary = metricsCollector.calculateSummary();
      
      expect(summary.totalVolume).toBe('600'); // 100 + 200 + 300 (only successful transactions)
      expect(summary.totalTransactions).toBe(5);
      expect(summary.successRate).toBe('60.00%'); // 3 out of 5 successful
      expect(summary.avgExecutionTime).toBe('1500ms'); // (1000 + 1500 + 2000) / 3 rounded
      
      expect(summary.transactionTypes).toEqual({
        swaps: 2,
        bridges: 1,
        deposits: 1,
        withdrawals: 1,
      });
      
      expect(summary.statusBreakdown).toEqual({
        success: 3,
        failed: 1,
        pending: 1,
      });
    });

    it('should handle empty metrics gracefully', () => {
      const emptyCollector = new MetricsCollector('testnet');
      emptyCollector.clearMetrics(); // Clear any existing data
      const summary = emptyCollector.calculateSummary();
      
      expect(summary.totalVolume).toBe('0');
      expect(summary.totalTransactions).toBe(0);
      expect(summary.successRate).toBe('0%');
      expect(summary.avgSlippage).toBe('0%');
      expect(summary.avgExecutionTime).toBe('0ms');
    });

    it('should calculate performance metrics correctly', () => {
      // Clear metrics first to avoid interference
      metricsCollector.clearMetrics();
      
      // Add transactions with gas data
      metricsCollector.recordTransaction({
        type: 'swap',
        status: 'success',
        amount: '100',
        gasUsed: '1000',
        gasPrice: '0.1',
        executionTime: 1000,
      });

      metricsCollector.recordTransaction({
        type: 'bridge',
        status: 'success',
        amount: '200',
        gasUsed: '2000',
        gasPrice: '0.2',
        executionTime: 2000,
      });

      const summary = metricsCollector.calculateSummary();
      
      expect(summary.performanceMetrics.avgGasUsed).toBe('1500'); // (1000 + 2000) / 2
      expect(summary.performanceMetrics.avgGasPrice).toBe('0.15'); // (0.1 + 0.2) / 2 - handle floating point
      expect(summary.performanceMetrics.fastestExecution).toBe('1000ms');
      expect(summary.performanceMetrics.slowestExecution).toBe('2000ms');
    });
  });

  describe('getTransactionsByDateRange', () => {
    beforeEach(() => {
      // Clear metrics first
      metricsCollector.clearMetrics();
      
      const baseTime = Date.now();
      
      // Create transactions at different times
      for (let i = 0; i < 5; i++) {
        const metricId = metricsCollector.recordTransaction({
          type: 'swap',
          status: 'success',
          amount: '100',
        });
        
        // Manually set timestamp for testing
        const transactions = metricsCollector.getTransactions();
        const transaction = transactions.find(t => t.id === metricId);
        if (transaction) {
          transaction.timestamp = baseTime + (i * 3600000); // 1 hour intervals
        }
      }
    });

    it('should return transactions within date range', () => {
      const baseTime = Date.now();
      const startDate = new Date(baseTime + 3600000); // 1 hour from base
      const endDate = new Date(baseTime + 10800000); // 3 hours from base
      
      const transactions = metricsCollector.getTransactionsByDateRange(startDate, endDate);
      
      expect(transactions.length).toBeGreaterThanOrEqual(2); // At least transactions at 1h and 2h
      expect(transactions.length).toBeLessThanOrEqual(3); // At most transactions at 1h, 2h, and 3h
      
      transactions.forEach(tx => {
        const txTime = new Date(tx.timestamp);
        expect(txTime.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txTime.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should return empty array for no matching transactions', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const futureDate2 = new Date(Date.now() + 172800000); // Day after tomorrow
      
      const transactions = metricsCollector.getTransactionsByDateRange(futureDate, futureDate2);
      expect(transactions).toHaveLength(0);
    });
  });

  describe('export and import', () => {
    it('should export and import metrics correctly', () => {
      // Create test transactions
      const metricId1 = metricsCollector.recordTransaction({
        type: 'swap',
        status: 'success',
        amount: '100',
      });

      const metricId2 = metricsCollector.recordTransaction({
        type: 'bridge',
        status: 'pending',
        amount: '200',
        targetChain: 'ethereum',
      });

      // Export metrics
      const exportedMetrics = metricsCollector.exportMetrics();
      expect(exportedMetrics).toHaveLength(2);
      
      // Create new collector and import
      const newCollector = new MetricsCollector('testnet');
      newCollector.importMetrics(exportedMetrics);
      
      const importedTransactions = newCollector.getTransactions();
      expect(importedTransactions).toHaveLength(2);
      
      const importedSwap = importedTransactions.find(t => t.id === metricId1);
      const importedBridge = importedTransactions.find(t => t.id === metricId2);
      
      expect(importedSwap?.type).toBe('swap');
      expect(importedBridge?.type).toBe('bridge');
      expect(importedBridge?.targetChain).toBe('ethereum');
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      // Add some transactions
      metricsCollector.recordTransaction({
        type: 'swap',
        status: 'success',
        amount: '100',
      });

      metricsCollector.recordTransaction({
        type: 'bridge',
        status: 'pending',
        amount: '200',
      });

      expect(metricsCollector.getTransactions()).toHaveLength(2);
      
      // Clear metrics
      metricsCollector.clearMetrics();
      
      expect(metricsCollector.getTransactions()).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should persist metrics to file system', async () => {
      // Use a completely isolated test setup
      const isolatedTestNetwork = 'isolated-test';
      const isolatedMetricsFile = join(testDataDir, `metrics-${isolatedTestNetwork}.json`);
      
      // Clean up any existing isolated test file
      if (existsSync(isolatedMetricsFile)) {
        unlinkSync(isolatedMetricsFile);
      }
      
      // Create isolated collector
      const isolatedCollector = new MetricsCollector(isolatedTestNetwork as any);
      (isolatedCollector as any).metricsFile = isolatedMetricsFile;
      isolatedCollector.clearMetrics();
      
      // Add a transaction
      isolatedCollector.recordTransaction({
        type: 'swap',
        status: 'success',
        amount: '100',
      });

      // Wait for async save to complete (debounced save)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if file was created
      expect(existsSync(isolatedMetricsFile)).toBe(true);

      // Create new collector (should load from file)
      const newCollector = new MetricsCollector(isolatedTestNetwork as any);
      (newCollector as any).metricsFile = isolatedMetricsFile;
      
      // Force reload from file
      (newCollector as any).loadMetrics();
      
      const transactions = newCollector.getTransactions();
      
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('swap');
      expect(transactions[0].amount).toBe('100');
      
      // Clean up isolated test file
      if (existsSync(isolatedMetricsFile)) {
        unlinkSync(isolatedMetricsFile);
      }
    });
  });
});
