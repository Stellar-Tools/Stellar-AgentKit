import { 
  TransactionMetrics, 
  PerformanceSummary, 
  AnalyticsConfig, 
  FilterOptions, 
  DetailedAnalytics,
  TransactionType 
} from './analytics';
import fs from 'fs';
import path from 'path';

/**
 * AnalyticsManager handles collection, storage, and analysis of transaction metrics
 */
export class AnalyticsManager {
  private transactions: TransactionMetrics[] = [];
  private config: AnalyticsConfig;
  private storagePath: string;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      enablePersistence: true,
      maxRecords: 10000,
      retentionDays: 30,
      ...config
    };
    
    this.storagePath = this.config.storagePath || path.join(process.cwd(), '.stellarkit-analytics');
    
    if (this.config.enablePersistence) {
      this.loadTransactions();
    }
  }

  /**
   * Start tracking a new transaction
   */
  startTransaction(type: TransactionType, data?: any): string {
    const id = this.generateTransactionId();
    const transaction: TransactionMetrics = {
      id,
      type,
      timestamp: Date.now(),
      status: 'pending',
      executionTime: 0,
      ...this.extractTransactionData(type, data)
    };

    this.transactions.push(transaction);
    this.saveTransactions();
    return id;
  }

  /**
   * Complete a transaction with success
   */
  completeTransaction(id: string, result: any, executionTime: number): void {
    const transaction = this.findTransaction(id);
    if (!transaction) return;

    transaction.status = 'success';
    transaction.executionTime = executionTime;
    transaction.hash = result.hash || result.transactionHash;
    
    // Extract additional data from result
    this.updateTransactionWithResult(transaction, result);
    
    this.saveTransactions();
  }

  /**
   * Mark a transaction as failed
   */
  failTransaction(id: string, error: Error | any): void {
    const transaction = this.findTransaction(id);
    if (!transaction) return;

    transaction.status = 'failed';
    transaction.error = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || String(error),
      details: error.details || error
    };
    
    this.saveTransactions();
  }

  /**
   * Get performance summary
   */
  getSummary(): PerformanceSummary {
    const transactions = this.getValidTransactions();
    
    const successful = transactions.filter(t => t.status === 'success');
    const failed = transactions.filter(t => t.status === 'failed');
    
    const summary: PerformanceSummary = {
      totalTransactions: transactions.length,
      successfulTransactions: successful.length,
      failedTransactions: failed.length,
      successRate: transactions.length > 0 
        ? ((successful.length / transactions.length) * 100).toFixed(2) + '%'
        : '0%',
      totalVolume: this.calculateTotalVolume(successful),
      averageExecutionTime: this.calculateAverageExecutionTime(successful),
      totalGasCost: this.calculateTotalGasCost(successful),
      insights: this.generateInsights(transactions)
    };

    // Add type-specific metrics
    this.addTypeSpecificMetrics(summary, successful);

    return summary;
  }

  /**
   * Get detailed analytics
   */
  getDetailedAnalytics(filter?: FilterOptions): DetailedAnalytics {
    const transactions = this.filterTransactions(filter);
    const summary = this.getSummary();
    
    return {
      summary,
      recentTransactions: transactions.slice(-50), // Last 50 transactions
      hourlyVolume: this.calculateHourlyVolume(transactions),
      assetPerformance: this.calculateAssetPerformance(transactions),
      errorAnalysis: this.analyzeErrors(transactions)
    };
  }

  /**
   * Get transactions with optional filtering
   */
  getTransactions(filter?: FilterOptions): TransactionMetrics[] {
    return this.filterTransactions(filter);
  }

  /**
   * Clear old transactions based on retention policy
   */
  cleanup(): void {
    if (!this.config.retentionDays) return;

    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.transactions = this.transactions.filter(t => t.timestamp > cutoffTime);
    
    // Enforce max records limit
    if (this.config.maxRecords && this.transactions.length > this.config.maxRecords) {
      this.transactions = this.transactions.slice(-this.config.maxRecords);
    }
    
    this.saveTransactions();
  }

  /**
   * Export analytics data to JSON
   */
  exportData(): string {
    return JSON.stringify({
      transactions: this.transactions,
      summary: this.getSummary(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  // Private helper methods

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findTransaction(id: string): TransactionMetrics | undefined {
    return this.transactions.find(t => t.id === id);
  }

  private extractTransactionData(type: TransactionType, data?: any): Partial<TransactionMetrics> {
    switch (type) {
      case 'swap':
        return {
          swapData: data ? {
            inputAsset: data.inputAsset || '',
            outputAsset: data.outputAsset || '',
            inputAmount: data.inputAmount || '0',
            outputAmount: data.outputAmount || '0',
            expectedOutput: data.expectedOutput,
            slippage: data.slippage
          } : undefined
        };
      
      case 'bridge':
        return {
          bridgeData: data ? {
            fromNetwork: data.fromNetwork || '',
            toNetwork: data.toNetwork || '',
            amount: data.amount || '0',
            asset: data.asset || '',
            targetAddress: data.targetAddress || '',
            bridgeFee: data.bridgeFee
          } : undefined
        };
      
      case 'lp_deposit':
      case 'lp_withdraw':
        return {
          lpData: data ? {
            poolAddress: data.poolAddress || '',
            tokenA: data.tokenA || '',
            tokenB: data.tokenB || '',
            amountA: data.amountA || '0',
            amountB: data.amountB || '0',
            shareAmount: data.shareAmount
          } : undefined
        };
      
      case 'token_launch':
        return {
          tokenLaunchData: data ? {
            tokenCode: data.tokenCode || '',
            issuer: data.issuer || '',
            distributor: data.distributor || '',
            initialSupply: data.initialSupply || '0',
            issuerLocked: data.issuerLocked || false
          } : undefined
        };
      
      default:
        return {};
    }
  }

  private updateTransactionWithResult(transaction: TransactionMetrics, result: any): void {
    // Update gas information if available
    if (result.gasUsed) transaction.gasUsed = result.gasUsed;
    if (result.gasCost) transaction.gasCost = result.gasCost;
    
    // Update type-specific result data
    if (transaction.type === 'swap' && transaction.swapData) {
      if (result.actualOutput) {
        transaction.swapData.outputAmount = result.actualOutput;
      }
      if (result.slippage) {
        transaction.swapData.slippage = result.slippage;
      }
    }
  }

  private getValidTransactions(): TransactionMetrics[] {
    return this.transactions.filter(t => t.status !== 'pending');
  }

  private calculateTotalVolume(transactions: TransactionMetrics[]): string {
    // This is a simplified calculation - in a real implementation,
    // you'd need to convert all amounts to USD using price feeds
    let total = 0;
    
    transactions.forEach(tx => {
      if (tx.swapData) {
        total += parseFloat(tx.swapData.inputAmount) || 0;
      } else if (tx.bridgeData) {
        total += parseFloat(tx.bridgeData.amount) || 0;
      } else if (tx.lpData) {
        total += parseFloat(tx.lpData.amountA) || 0;
        total += parseFloat(tx.lpData.amountB) || 0;
      } else if (tx.tokenLaunchData) {
        total += parseFloat(tx.tokenLaunchData.initialSupply) || 0;
      }
    });
    
    return total.toString();
  }

  private calculateAverageExecutionTime(transactions: TransactionMetrics[]): number {
    if (transactions.length === 0) return 0;
    
    const totalTime = transactions.reduce((sum, tx) => sum + tx.executionTime, 0);
    return Math.round(totalTime / transactions.length);
  }

  private calculateTotalGasCost(transactions: TransactionMetrics[]): string {
    const total = transactions.reduce((sum, tx) => {
      return sum + (parseFloat(tx.gasCost || '0') || 0);
    }, 0);
    
    return total.toString();
  }

  private generateInsights(transactions: TransactionMetrics[]): PerformanceSummary['insights'] {
    const successful = transactions.filter(t => t.status === 'success');
    const failed = transactions.filter(t => t.status === 'failed');
    
    // Find fastest and slowest transactions
    const fastest = successful.reduce((fastest, current) => 
      current.executionTime < fastest.executionTime ? current : fastest, 
      successful[0] || { type: 'swap', executionTime: 0 }
    );
    
    const slowest = successful.reduce((slowest, current) => 
      current.executionTime > slowest.executionTime ? current : slowest, 
      successful[0] || { type: 'swap', executionTime: 0 }
    );
    
    // Find most active hour
    const hourlyActivity = new Array(24).fill(0);
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourlyActivity[hour]++;
    });
    const mostActiveHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    
    // Find most common error
    const errorCounts = new Map<string, number>();
    failed.forEach(tx => {
      if (tx.error) {
        const errorKey = tx.error.code || tx.error.message;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      }
    });
    
    const mostCommonError = [...errorCounts.entries()]
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    return {
      fastestTransaction: {
        type: fastest.type,
        time: fastest.executionTime,
        hash: fastest.hash
      },
      slowestTransaction: {
        type: slowest.type,
        time: slowest.executionTime,
        hash: slowest.hash
      },
      mostActiveHour,
      errorRate: transactions.length > 0 
        ? ((failed.length / transactions.length) * 100).toFixed(2) + '%'
        : '0%',
      mostCommonError
    };
  }

  private addTypeSpecificMetrics(summary: PerformanceSummary, successful: TransactionMetrics[]): void {
    // Swap metrics
    const swaps = successful.filter(t => t.type === 'swap');
    if (swaps.length > 0) {
      const slippages = swaps
        .filter(s => s.swapData?.slippage)
        .map(s => parseFloat(s.swapData!.slippage!));
      
      summary.swapMetrics = {
        totalSwaps: swaps.length,
        totalSwapVolume: swaps.reduce((sum, s) => 
          sum + (parseFloat(s.swapData?.inputAmount || '0') || 0), 0).toString(),
        averageSlippage: slippages.length > 0 
          ? (slippages.reduce((a, b) => a + b, 0) / slippages.length).toFixed(2) + '%'
          : '0%',
        bestSlippage: slippages.length > 0 ? Math.min(...slippages).toFixed(2) + '%' : '0%',
        worstSlippage: slippages.length > 0 ? Math.max(...slippages).toFixed(2) + '%' : '0%'
      };
    }

    // Bridge metrics
    const bridges = successful.filter(t => t.type === 'bridge');
    if (bridges.length > 0) {
      const chainCounts = new Map<string, number>();
      bridges.forEach(b => {
        if (b.bridgeData?.toNetwork) {
          chainCounts.set(b.bridgeData.toNetwork, 
            (chainCounts.get(b.bridgeData.toNetwork) || 0) + 1);
        }
      });
      
      const mostUsedChain = [...chainCounts.entries()]
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '';
      
      summary.bridgeMetrics = {
        totalBridges: bridges.length,
        totalBridgeVolume: bridges.reduce((sum, b) => 
          sum + (parseFloat(b.bridgeData?.amount || '0') || 0), 0).toString(),
        averageBridgeFee: bridges.reduce((sum, b) => 
          sum + (parseFloat(b.bridgeData?.bridgeFee || '0') || 0), 0).toString(),
        mostUsedTargetChain: mostUsedChain
      };
    }

    // LP metrics
    const deposits = successful.filter(t => t.type === 'lp_deposit');
    const withdrawals = successful.filter(t => t.type === 'lp_withdraw');
    
    if (deposits.length > 0 || withdrawals.length > 0) {
      summary.lpMetrics = {
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        totalLiquidityAdded: deposits.reduce((sum, d) => 
          sum + (parseFloat(d.lpData?.amountA || '0') || 0) + 
          (parseFloat(d.lpData?.amountB || '0') || 0), 0).toString(),
        totalLiquidityRemoved: withdrawals.reduce((sum, w) => 
          sum + (parseFloat(w.lpData?.amountA || '0') || 0) + 
          (parseFloat(w.lpData?.amountB || '0') || 0), 0).toString()
      };
    }
  }

  private filterTransactions(filter?: FilterOptions): TransactionMetrics[] {
    let filtered = [...this.transactions];
    
    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(t => t.type === filter.type);
      }
      
      if (filter.status) {
        filtered = filtered.filter(t => t.status === filter.status);
      }
      
      if (filter.startDate) {
        filtered = filtered.filter(t => t.timestamp >= filter.startDate!.getTime());
      }
      
      if (filter.endDate) {
        filtered = filtered.filter(t => t.timestamp <= filter.endDate!.getTime());
      }
      
      if (filter.asset) {
        filtered = filtered.filter(t => 
          t.swapData?.inputAsset === filter.asset ||
          t.swapData?.outputAsset === filter.asset ||
          t.bridgeData?.asset === filter.asset ||
          t.lpData?.tokenA === filter.asset ||
          t.lpData?.tokenB === filter.asset
        );
      }
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  private calculateHourlyVolume(transactions: TransactionMetrics[]): Array<{hour: number, volume: string, transactionCount: number}> {
    const hourlyData = new Array(24).fill(null).map(() => ({
      hour: 0,
      volume: '0',
      transactionCount: 0
    }));
    
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourlyData[hour].hour = hour;
      hourlyData[hour].transactionCount++;
      
      // Add volume calculation (simplified)
      let volume = 0;
      if (tx.swapData) volume += parseFloat(tx.swapData.inputAmount) || 0;
      else if (tx.bridgeData) volume += parseFloat(tx.bridgeData.amount) || 0;
      else if (tx.lpData) volume += (parseFloat(tx.lpData.amountA) || 0) + (parseFloat(tx.lpData.amountB) || 0);
      
      hourlyData[hour].volume = (parseFloat(hourlyData[hour].volume) + volume).toString();
    });
    
    return hourlyData;
  }

  private calculateAssetPerformance(transactions: TransactionMetrics[]): Array<{asset: string, totalVolume: string, transactionCount: number, averageSlippage?: string}> {
    const assetMap = new Map<string, {volume: number, count: number, slippages: number[]}>();
    
    transactions.forEach(tx => {
      const assets = this.extractAssetsFromTransaction(tx);
      assets.forEach(asset => {
        if (!assetMap.has(asset)) {
          assetMap.set(asset, { volume: 0, count: 0, slippages: [] });
        }
        
        const data = assetMap.get(asset)!;
        data.count++;
        
        // Add volume
        let volume = 0;
        if (tx.swapData) {
          if (tx.swapData.inputAsset === asset) volume += parseFloat(tx.swapData.inputAmount) || 0;
          if (tx.swapData.outputAsset === asset) volume += parseFloat(tx.swapData.outputAmount) || 0;
        } else if (tx.bridgeData && tx.bridgeData.asset === asset) {
          volume += parseFloat(tx.bridgeData.amount) || 0;
        } else if (tx.lpData) {
          if (tx.lpData.tokenA === asset) volume += parseFloat(tx.lpData.amountA) || 0;
          if (tx.lpData.tokenB === asset) volume += parseFloat(tx.lpData.amountB) || 0;
        }
        
        data.volume += volume;
        
        // Add slippage for swaps
        if (tx.swapData && tx.swapData.slippage && 
            (tx.swapData.inputAsset === asset || tx.swapData.outputAsset === asset)) {
          data.slippages.push(parseFloat(tx.swapData.slippage));
        }
      });
    });
    
    return Array.from(assetMap.entries()).map(([asset, data]) => ({
      asset,
      totalVolume: data.volume.toString(),
      transactionCount: data.count,
      averageSlippage: data.slippages.length > 0 
        ? (data.slippages.reduce((a, b) => a + b, 0) / data.slippages.length).toFixed(2) + '%'
        : undefined
    }));
  }

  private extractAssetsFromTransaction(tx: TransactionMetrics): string[] {
    const assets: string[] = [];
    
    if (tx.swapData) {
      assets.push(tx.swapData.inputAsset, tx.swapData.outputAsset);
    } else if (tx.bridgeData) {
      assets.push(tx.bridgeData.asset);
    } else if (tx.lpData) {
      assets.push(tx.lpData.tokenA, tx.lpData.tokenB);
    } else if (tx.tokenLaunchData) {
      assets.push(tx.tokenLaunchData.tokenCode);
    }
    
    return assets.filter(a => a && a !== '');
  }

  private analyzeErrors(transactions: TransactionMetrics[]): Array<{error: string, count: number, percentage: string, recentOccurrences: string[]}> {
    const errorMap = new Map<string, {count: number, occurrences: string[]}>();
    const failed = transactions.filter(t => t.status === 'failed' && t.error);
    
    failed.forEach(tx => {
      const errorKey = tx.error!.code || tx.error!.message;
      if (!errorMap.has(errorKey)) {
        errorMap.set(errorKey, { count: 0, occurrences: [] });
      }
      
      const data = errorMap.get(errorKey)!;
      data.count++;
      data.occurrences.push(new Date(tx.timestamp).toISOString());
    });
    
    const totalErrors = failed.length;
    
    return Array.from(errorMap.entries()).map(([error, data]) => ({
      error,
      count: data.count,
      percentage: totalErrors > 0 ? ((data.count / totalErrors) * 100).toFixed(2) + '%' : '0%',
      recentOccurrences: data.occurrences.slice(-5) // Last 5 occurrences
    }));
  }

  private loadTransactions(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        this.transactions = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load analytics data:', error);
      this.transactions = [];
    }
  }

  private saveTransactions(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.storagePath, JSON.stringify(this.transactions, null, 2));
    } catch (error) {
      console.warn('Failed to save analytics data:', error);
    }
  }
}
