# Transaction Analytics and Performance Metrics

The Stellar AgentKit now includes comprehensive transaction analytics and performance metrics, providing deep insights into your DeFi operations including swaps, bridges, and liquidity pool activities.

## Overview

The analytics system addresses the key pain points mentioned in the GitHub issue:

- **Historical Tracking**: All transactions are automatically tracked and stored
- **Performance Insights**: Detailed metrics on execution time, slippage, and success rates
- **Debugging Visibility**: Complete transaction history with error analysis
- **Risk Analytics**: Comprehensive risk metrics and performance patterns

## Quick Start

```typescript
import { AgentClient } from 'stellarkit';

const agent = new AgentClient({
  network: "testnet",
  allowMainnet: false
});

// Execute transactions (they're automatically tracked)
await agent.swap({
  to: "GD...destination",
  buyA: true,
  out: "1000",
  inMax: "1100"
});

// Get performance summary
const summary = agent.metrics.summary();
console.log(`Total Volume: ${summary.totalVolume}`);
console.log(`Success Rate: ${summary.successRate}`);
console.log(`Average Slippage: ${summary.swapMetrics?.averageSlippage}`);
```

## API Reference

### `agent.metrics.summary()`

Returns a comprehensive performance summary of all transactions.

```typescript
interface PerformanceSummary {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: string;
  totalVolume: string;
  averageExecutionTime: number;
  totalGasCost: string;
  
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
  
  insights: {
    fastestTransaction: { type: string; time: number; hash?: string };
    slowestTransaction: { type: string; time: number; hash?: string };
    mostActiveHour: number;
    errorRate: string;
    mostCommonError?: string;
  };
}
```

### `agent.metrics.detailed(filter?)`

Returns detailed analytics with filtering options.

```typescript
interface DetailedAnalytics {
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
```

### `agent.metrics.getTransactions(filter?)`

Returns raw transaction data with optional filtering.

```typescript
interface FilterOptions {
  type?: 'swap' | 'bridge' | 'lp_deposit' | 'lp_withdraw' | 'token_launch';
  status?: 'pending' | 'success' | 'failed';
  startDate?: Date;
  endDate?: Date;
  minAmount?: string;
  maxAmount?: string;
  asset?: string;
  limit?: number;
}
```

### `agent.metrics.export()`

Exports all analytics data to JSON format for backup or analysis.

```typescript
const exportData = agent.metrics.export();
// Save to file
fs.writeFileSync('analytics-backup.json', exportData);
```

### `agent.metrics.cleanup()`

Cleans up old transaction data based on retention policy.

```typescript
agent.metrics.cleanup();
```

## Use Cases

### 1. Trading Dashboards

Create comprehensive trading dashboards with real-time insights:

```typescript
// Real-time performance monitoring
const monitorPerformance = () => {
  const summary = agent.metrics.summary();
  
  // Alert on performance issues
  if (parseFloat(summary.successRate) < 95) {
    console.warn(`Success rate dropped to ${summary.successRate}%`);
  }
  
  if (summary.averageExecutionTime > 5000) {
    console.warn(`Average execution time: ${summary.averageExecutionTime}ms`);
  }
  
  // Display key metrics
  console.log(`Total Volume: $${summary.totalVolume}`);
  console.log(`Success Rate: ${summary.successRate}`);
  console.log(`Average Slippage: ${summary.swapMetrics?.averageSlippage}`);
};
```

### 2. Trading Insights

Analyze trading patterns and optimize strategies:

```typescript
// Get detailed swap analytics
const swapAnalytics = agent.metrics.detailed({ type: 'swap' });

// Find best performing assets
const topAssets = swapAnalytics.assetPerformance
  .sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume))
  .slice(0, 5);

// Analyze slippage patterns
const highSlippageTrades = agent.metrics.getTransactions({
  type: 'swap'
}).filter(tx => parseFloat(tx.swapData?.slippage || '0') > 2);

console.log('Top Assets by Volume:', topAssets);
console.log('High Slippage Trades:', highSlippageTrades.length);
```

### 3. Debugging and Error Analysis

Quickly identify and resolve issues:

```typescript
// Get recent failed transactions
const failedTransactions = agent.metrics.getTransactions({
  status: 'failed',
  limit: 10
});

// Analyze error patterns
const errorAnalysis = agent.metrics.detailed().errorAnalysis;
const mostCommonError = errorAnalysis[0];

console.log('Most Common Error:', mostCommonError.error);
console.log('Occurrences:', mostCommonError.count);
console.log('Recent Examples:', mostCommonError.recentOccurrences);
```

### 4. Risk Analytics

Monitor risk metrics and set up alerts:

```typescript
// Risk monitoring
const assessRisk = () => {
  const summary = agent.metrics.summary();
  const detailed = agent.metrics.detailed();
  
  // High error rate risk
  const errorRate = parseFloat(summary.insights.errorRate);
  if (errorRate > 10) {
    console.error('HIGH RISK: Error rate is', summary.insights.errorRate);
  }
  
  // Concentration risk (too much volume in one asset)
  const assetConcentration = detailed.assetPerformance
    .find(a => parseFloat(a.totalVolume) > parseFloat(summary.totalVolume) * 0.8);
  
  if (assetConcentration) {
    console.warn('CONCENTRATION RISK: High exposure to', assetConcentration.asset);
  }
  
  // Performance degradation
  if (summary.averageExecutionTime > 10000) {
    console.warn('PERFORMANCE RISK: Slow execution times detected');
  }
};
```

## Configuration

The analytics system can be configured during AgentClient initialization:

```typescript
const agent = new AgentClient({
  network: "testnet",
  allowMainnet: false,
  analytics: {
    enablePersistence: true,        // Save data to disk
    storagePath: './analytics-data', // Custom storage location
    maxRecords: 10000,             // Maximum records to keep
    retentionDays: 30              // Days to keep records
  }
});
```

## Data Storage

Analytics data is automatically persisted to disk (when enabled) and includes:

- **Transaction History**: Complete record of all transactions
- **Performance Metrics**: Execution times, gas costs, slippage
- **Error Information**: Detailed error tracking and analysis
- **Timestamps**: Precise timing for all operations

Data is stored in JSON format and can be exported for external analysis.

## Performance Considerations

- **Memory Usage**: Analytics data is stored efficiently with configurable limits
- **Disk Space**: Automatic cleanup based on retention policies
- **Query Performance**: Optimized filtering and aggregation
- **Async Operations**: Non-blocking data collection and analysis

## Security and Privacy

- **No Sensitive Data**: Private keys and secrets are never logged
- **Local Storage**: All data is stored locally by default
- **Configurable Retention**: Automatic cleanup of old data
- **Export Control**: Full control over data export and sharing

## Examples

### Basic Usage

```typescript
import { AgentClient } from 'stellarkit';

const agent = new AgentClient({ network: "testnet" });

// Execute some transactions
await agent.swap({ to: "GD...", buyA: true, out: "1000", inMax: "1100" });
await agent.bridge({ amount: "100", toAddress: "0x...", targetChain: "ethereum" });

// Get summary
const summary = agent.metrics.summary();
console.log(`Success Rate: ${summary.successRate}`);
console.log(`Total Volume: ${summary.totalVolume}`);
```

### Advanced Analysis

```typescript
// Get detailed analytics for specific time period
const lastWeek = agent.metrics.detailed({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
});

// Analyze hourly patterns
const peakHours = lastWeek.hourlyVolume
  .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
  .slice(0, 3);

console.log('Peak Trading Hours:', peakHours);

// Find problematic transactions
const problemTransactions = agent.metrics.getTransactions({
  status: 'failed'
}).filter(tx => tx.executionTime > 5000);

console.log('Slow Failed Transactions:', problemTransactions);
```

### Real-time Monitoring

```typescript
// Set up monitoring
const setupMonitoring = () => {
  setInterval(() => {
    const summary = agent.metrics.summary();
    
    // Check for issues
    if (parseFloat(summary.successRate) < 95) {
      sendAlert(`Success rate: ${summary.successRate}%`);
    }
    
    if (summary.averageExecutionTime > 8000) {
      sendAlert(`Slow execution: ${summary.averageExecutionTime}ms`);
    }
    
    // Update dashboard
    updateDashboard(summary);
  }, 60000); // Check every minute
};
```

## Integration with Existing Tools

The analytics system integrates seamlessly with existing AgentKit tools:

- **Swaps**: Automatic tracking of input/output amounts and slippage
- **Bridges**: Cross-chain transaction monitoring
- **LP Operations**: Liquidity provision and withdrawal tracking
- **Token Launches**: Complete token deployment analytics

## Troubleshooting

### Common Issues

1. **No Data Showing**: Ensure transactions have been executed after analytics was enabled
2. **High Memory Usage**: Reduce `maxRecords` or enable `cleanup()` regularly
3. **Missing Metrics**: Check that transactions are completing successfully

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const agent = new AgentClient({
  network: "testnet",
  analytics: {
    enablePersistence: true,
    debugMode: true // Enable detailed logging
  }
});
```

## Migration Guide

If you're upgrading from a version without analytics:

1. **No Breaking Changes**: Existing code continues to work
2. **Automatic Enablement**: Analytics starts tracking immediately
3. **Gradual Adoption**: Use metrics API as needed without affecting existing operations

## Best Practices

1. **Regular Cleanup**: Run `agent.metrics.cleanup()` periodically
2. **Monitor Performance**: Set up alerts for success rate and execution time
3. **Export Data**: Regularly export analytics data for backup
4. **Error Analysis**: Review error patterns to improve reliability
5. **Asset Monitoring**: Track concentration risk across different assets

## Future Enhancements

Planned improvements to the analytics system:

- **Real-time Webhooks**: Instant notifications for important events
- **Advanced Charting**: Built-in visualization capabilities
- **Machine Learning**: Predictive analytics and anomaly detection
- **Multi-chain Support**: Cross-chain analytics and comparison
- **API Integration**: External dashboard and monitoring tool support
