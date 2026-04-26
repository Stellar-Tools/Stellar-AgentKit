import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export type NetworkType = "testnet" | "mainnet";

export interface TransactionMetrics {
  id: string;
  type: 'swap' | 'bridge' | 'deposit' | 'withdraw';
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  amount?: string;
  asset?: string;
  fromAddress?: string;
  toAddress?: string;
  targetChain?: string;
  contractAddress?: string;
  gasUsed?: string;
  gasPrice?: string;
  slippage?: string;
  errorMessage?: string;
  executionTime?: number; // milliseconds
  blockNumber?: number;
  transactionHash?: string;
}

export interface MetricsSummary {
  totalVolume: string;
  totalTransactions: number;
  successRate: string;
  avgSlippage: string;
  avgExecutionTime: string;
  transactionTypes: {
    swaps: number;
    bridges: number;
    deposits: number;
    withdrawals: number;
  };
  statusBreakdown: {
    success: number;
    failed: number;
    pending: number;
  };
  chainBreakdown?: Record<string, number>;
  assetBreakdown?: Record<string, number>;
  recentTransactions: TransactionMetrics[];
  performanceMetrics: {
    avgGasUsed: string;
    avgGasPrice: string;
    fastestExecution: string;
    slowestExecution: string;
  };
}

export class MetricsCollector {
  private metrics: TransactionMetrics[] = [];
  private metricsFile: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(network: NetworkType) {
    this.metricsFile = join(homedir(), '.stellartools', `metrics-${network}.json`);
    this.loadMetrics();
  }

  private loadMetrics(): void {
    try {
      if (existsSync(this.metricsFile)) {
        const data = readFileSync(this.metricsFile, 'utf8');
        this.metrics = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      this.metrics = [];
    }
  }

  private saveMetrics(): void {
    // Debounce saves to avoid blocking the event loop
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      try {
        const dataDir = dirname(this.metricsFile);
        if (!existsSync(dataDir)) {
          require('fs').mkdirSync(dataDir, { recursive: true });
        }
        require('fs').writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
      } catch (error) {
        console.error('Failed to save metrics:', error);
      }
    }, 100); // Debounce for 100ms
  }

  recordTransaction(metric: Omit<TransactionMetrics, 'id' | 'timestamp'>): string {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transaction: TransactionMetrics = {
      ...metric,
      id,
      timestamp: Date.now(),
    };

    this.metrics.push(transaction);
    this.saveMetrics();
    return id;
  }

  updateTransactionStatus(id: string, status: TransactionMetrics['status'], additionalData?: Partial<TransactionMetrics>): void {
    const index = this.metrics.findIndex(m => m.id === id);
    if (index !== -1) {
      this.metrics[index].status = status;
      if (additionalData) {
        // Prevent overwrite of protected fields
        const { id: _id, timestamp: _timestamp, status: _status, ...safeData } = additionalData;
        Object.assign(this.metrics[index], safeData);
      }
      this.saveMetrics();
    }
  }

  getTransactions(limit?: number, type?: TransactionMetrics['type']): TransactionMetrics[] {
    let filtered = this.metrics;
    
    if (type) {
      filtered = filtered.filter(m => m.type === type);
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    return limit ? filtered.slice(0, limit) : filtered;
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): TransactionMetrics[] {
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    return this.metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  calculateSummary(): MetricsSummary {
    if (this.metrics.length === 0) {
      return {
        totalVolume: "0",
        totalTransactions: 0,
        successRate: "0%",
        avgSlippage: "0%",
        avgExecutionTime: "0ms",
        transactionTypes: {
          swaps: 0,
          bridges: 0,
          deposits: 0,
          withdrawals: 0,
        },
        statusBreakdown: {
          success: 0,
          failed: 0,
          pending: 0,
        },
        recentTransactions: [],
        performanceMetrics: {
          avgGasUsed: "0",
          avgGasPrice: "0",
          fastestExecution: "0ms",
          slowestExecution: "0ms",
        },
      };
    }

    const successful = this.metrics.filter(m => m.status === 'success');
    const failed = this.metrics.filter(m => m.status === 'failed');
    const pending = this.metrics.filter(m => m.status === 'pending');

    // Calculate total volume
    const totalVolume = successful.reduce((sum, m) => {
      if (m.amount) {
        const amount = parseFloat(m.amount);
        return sum + (isNaN(amount) ? 0 : amount);
      }
      return sum;
    }, 0);

    // Calculate success rate
    const successRate = this.metrics.length > 0 
      ? (successful.length / this.metrics.length * 100).toFixed(2) + '%'
      : '0%';

    // Calculate average slippage
    const slippageValues = successful
      .filter(m => m.slippage)
      .map(m => parseFloat(m.slippage!.replace('%', '')));
    
    const avgSlippage = slippageValues.length > 0
      ? (slippageValues.reduce((sum, val) => sum + val, 0) / slippageValues.length).toFixed(2) + '%'
      : '0%';

    // Calculate average execution time
    const executionTimes = successful
      .filter(m => m.executionTime !== undefined)
      .map(m => m.executionTime!);
    
    const avgExecutionTime = executionTimes.length > 0
      ? (executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length).toFixed(0) + 'ms'
      : '0ms';

    // Count transaction types
    const transactionTypes = {
      swaps: this.metrics.filter(m => m.type === 'swap').length,
      bridges: this.metrics.filter(m => m.type === 'bridge').length,
      deposits: this.metrics.filter(m => m.type === 'deposit').length,
      withdrawals: this.metrics.filter(m => m.type === 'withdraw').length,
    };

    // Status breakdown
    const statusBreakdown = {
      success: successful.length,
      failed: failed.length,
      pending: pending.length,
    };

    // Chain breakdown for bridges
    const chainBreakdown: Record<string, number> = {};
    this.metrics.filter(m => m.type === 'bridge' && m.targetChain).forEach(m => {
      const chain = m.targetChain!;
      chainBreakdown[chain] = (chainBreakdown[chain] || 0) + 1;
    });

    // Asset breakdown
    const assetBreakdown: Record<string, number> = {};
    this.metrics.filter(m => m.asset).forEach(m => {
      const asset = m.asset!;
      assetBreakdown[asset] = (assetBreakdown[asset] || 0) + 1;
    });

    // Performance metrics
    const gasUseds = successful.filter(m => m.gasUsed).map(m => parseFloat(m.gasUsed!));
    const gasPrices = successful.filter(m => m.gasPrice).map(m => parseFloat(m.gasPrice!));
    
    const avgGasUsed = gasUseds.length > 0 
      ? gasUseds.reduce((sum, val) => sum + val, 0) / gasUseds.length 
      : 0;
    
    const avgGasPrice = gasPrices.length > 0 
      ? Number((gasPrices.reduce((sum, val) => sum + val, 0) / gasPrices.length).toFixed(2))
      : 0;

    const fastestExecution = executionTimes.length > 0 
      ? Math.min(...executionTimes) + 'ms' 
      : '0ms';
    
    const slowestExecution = executionTimes.length > 0 
      ? Math.max(...executionTimes) + 'ms' 
      : '0ms';

    // Get recent transactions (last 10)
    const recentTransactions = this.getTransactions(10);

    return {
      totalVolume: totalVolume.toString(),
      totalTransactions: this.metrics.length,
      successRate,
      avgSlippage,
      avgExecutionTime,
      transactionTypes,
      statusBreakdown,
      chainBreakdown: Object.keys(chainBreakdown).length > 0 ? chainBreakdown : undefined,
      assetBreakdown: Object.keys(assetBreakdown).length > 0 ? assetBreakdown : undefined,
      recentTransactions,
      performanceMetrics: {
        avgGasUsed: avgGasUsed.toString(),
        avgGasPrice: avgGasPrice.toString(),
        fastestExecution,
        slowestExecution,
      },
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    this.saveMetrics();
  }

  exportMetrics(): TransactionMetrics[] {
    return [...this.metrics];
  }

  importMetrics(metrics: TransactionMetrics[]): void {
    this.metrics = metrics;
    this.saveMetrics();
  }
}
