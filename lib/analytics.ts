/**
 * Transaction Analytics and Performance Metrics for Stellar AgentKit
 * 
 * This module provides comprehensive tracking and analysis of transaction performance,
 * including swaps, bridges, and liquidity pool operations.
 */

export type TransactionType = 'swap' | 'bridge' | 'lp_deposit' | 'lp_withdraw' | 'token_launch';

export interface TransactionMetrics {
  id: string;
  type: TransactionType;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  hash?: string;
  
  // Common metrics
  executionTime: number; // Time in milliseconds
  gasUsed?: string;
  gasCost?: string;
  
  // Swap-specific metrics
  swapData?: {
    inputAsset: string;
    outputAsset: string;
    inputAmount: string;
    outputAmount: string;
    expectedOutput?: string;
    slippage?: string; // Percentage
    route?: string; // Route description
  };
  
  // Bridge-specific metrics
  bridgeData?: {
    fromNetwork: string;
    toNetwork: string;
    amount: string;
    asset: string;
    targetAddress: string;
    bridgeFee?: string;
  };
  
  // LP-specific metrics
  lpData?: {
    poolAddress: string;
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
    shareAmount?: string;
  };
  
  // Token launch metrics
  tokenLaunchData?: {
    tokenCode: string;
    issuer: string;
    distributor: string;
    initialSupply: string;
    issuerLocked: boolean;
  };
  
  // Error information
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PerformanceSummary {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: string; // Percentage
  totalVolume: string; // Total USD value of all transactions
  averageExecutionTime: number; // In milliseconds
  totalGasCost: string;
  
  // Type-specific summaries
  swapMetrics?: {
    totalSwaps: number;
    totalSwapVolume: string;
    averageSlippage: string;
    bestSlippage: string;
    worstSlippage: string;
  };
  
  bridgeMetrics?: {
    totalBridges: number;
    totalBridgeVolume: string;
    averageBridgeFee: string;
    mostUsedTargetChain: string;
  };
  
  lpMetrics?: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalLiquidityAdded: string;
    totalLiquidityRemoved: string;
  };
  
  // Performance insights
  insights: {
    fastestTransaction: {
      type: TransactionType;
      time: number;
      hash?: string;
    };
    slowestTransaction: {
      type: TransactionType;
      time: number;
      hash?: string;
    };
    mostActiveHour: number; // 0-23
    errorRate: string; // Percentage
    mostCommonError?: string;
  };
}

export interface AnalyticsConfig {
  enablePersistence?: boolean;
  storagePath?: string;
  maxRecords?: number;
  retentionDays?: number;
}

export interface FilterOptions {
  type?: TransactionType;
  status?: 'pending' | 'success' | 'failed';
  startDate?: Date;
  endDate?: Date;
  minAmount?: string;
  maxAmount?: string;
  asset?: string;
  limit?: number;
}

export interface DetailedAnalytics {
  summary: PerformanceSummary;
  recentTransactions: TransactionMetrics[];
  hourlyVolume: Array<{
    hour: number;
    volume: string;
    transactionCount: number;
  }>;
  assetPerformance: Array<{
    asset: string;
    totalVolume: string;
    transactionCount: number;
    averageSlippage?: string;
  }>;
  errorAnalysis: Array<{
    error: string;
    count: number;
    percentage: string;
    recentOccurrences: string[];
  }>;
}
