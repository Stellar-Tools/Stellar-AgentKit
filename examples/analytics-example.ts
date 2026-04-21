/**
 * Example: Transaction Analytics and Performance Metrics
 * 
 * This example demonstrates how to use the AgentKit analytics API to track
 * and analyze transaction performance, including swaps, bridges, and LP operations.
 */

import { AgentClient } from '../agent';

async function analyticsExample() {
  // Initialize the agent with analytics enabled
  const agent = new AgentClient({
    network: "testnet",
    allowMainnet: false
  });

  console.log('=== Stellar AgentKit Analytics Example ===\n');

  try {
    // 1. Perform some transactions to generate analytics data
    console.log('1. Performing transactions to generate analytics data...\n');

    // Example swap (this would normally execute a real swap)
    console.log('Executing swap...');
    try {
      // Note: This is a simplified example - in real usage, you'd provide actual parameters
      // await agent.swap({
      //   to: "GD... destination address",
      //   buyA: true,
      //   out: "1000",
      //   inMax: "1100",
      //   contractAddress: "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ"
      // });
      console.log('Swap executed successfully');
    } catch (error) {
      console.log('Swap failed (expected in example)');
    }

    // Example bridge transaction
    console.log('Executing bridge...');
    try {
      // await agent.bridge({
      //   amount: "100",
      //   toAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
      //   targetChain: "ethereum"
      // });
      console.log('Bridge executed successfully');
    } catch (error) {
      console.log('Bridge failed (expected in example)');
    }

    // Example LP deposit
    console.log('Executing LP deposit...');
    try {
      // await agent.lp.deposit({
      //   to: "GD... pool address",
      //   desiredA: "1000",
      //   minA: "950",
      //   desiredB: "2000",
      //   minB: "1900",
      //   contractAddress: "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ"
      // });
      console.log('LP deposit executed successfully');
    } catch (error) {
      console.log('LP deposit failed (expected in example)');
    }

    // 2. Get performance summary
    console.log('\n2. Getting performance summary...\n');
    const summary = agent.metrics.summary();
    
    console.log('=== Performance Summary ===');
    console.log(`Total Transactions: ${summary.totalTransactions}`);
    console.log(`Successful Transactions: ${summary.successfulTransactions}`);
    console.log(`Failed Transactions: ${summary.failedTransactions}`);
    console.log(`Success Rate: ${summary.successRate}`);
    console.log(`Total Volume: ${summary.totalVolume}`);
    console.log(`Average Execution Time: ${summary.averageExecutionTime}ms`);
    console.log(`Total Gas Cost: ${summary.totalGasCost}`);

    if (summary.swapMetrics) {
      console.log('\n--- Swap Metrics ---');
      console.log(`Total Swaps: ${summary.swapMetrics.totalSwaps}`);
      console.log(`Total Swap Volume: ${summary.swapMetrics.totalSwapVolume}`);
      console.log(`Average Slippage: ${summary.swapMetrics.averageSlippage}`);
      console.log(`Best Slippage: ${summary.swapMetrics.bestSlippage}`);
      console.log(`Worst Slippage: ${summary.swapMetrics.worstSlippage}`);
    }

    if (summary.bridgeMetrics) {
      console.log('\n--- Bridge Metrics ---');
      console.log(`Total Bridges: ${summary.bridgeMetrics.totalBridges}`);
      console.log(`Total Bridge Volume: ${summary.bridgeMetrics.totalBridgeVolume}`);
      console.log(`Average Bridge Fee: ${summary.bridgeMetrics.averageBridgeFee}`);
      console.log(`Most Used Target Chain: ${summary.bridgeMetrics.mostUsedTargetChain}`);
    }

    if (summary.lpMetrics) {
      console.log('\n--- LP Metrics ---');
      console.log(`Total Deposits: ${summary.lpMetrics.totalDeposits}`);
      console.log(`Total Withdrawals: ${summary.lpMetrics.totalWithdrawals}`);
      console.log(`Total Liquidity Added: ${summary.lpMetrics.totalLiquidityAdded}`);
      console.log(`Total Liquidity Removed: ${summary.lpMetrics.totalLiquidityRemoved}`);
    }

    console.log('\n--- Performance Insights ---');
    console.log(`Fastest Transaction: ${summary.insights.fastestTransaction.type} (${summary.insights.fastestTransaction.time}ms)`);
    console.log(`Slowest Transaction: ${summary.insights.slowestTransaction.type} (${summary.insights.slowestTransaction.time}ms)`);
    console.log(`Most Active Hour: ${summary.insights.mostActiveHour}:00`);
    console.log(`Error Rate: ${summary.insights.errorRate}`);
    if (summary.insights.mostCommonError) {
      console.log(`Most Common Error: ${summary.insights.mostCommonError}`);
    }

    // 3. Get detailed analytics
    console.log('\n3. Getting detailed analytics...\n');
    const detailed = agent.metrics.detailed({
      type: 'swap'
    });

    console.log('=== Detailed Analytics (Swaps Only) ===');
    console.log(`Recent Transactions: ${detailed.recentTransactions.length}`);
    
    console.log('\n--- Hourly Volume ---');
    detailed.hourlyVolume.forEach(hour => {
      if (hour.transactionCount > 0) {
        console.log(`Hour ${hour.hour}:00 - Volume: ${hour.volume}, Transactions: ${hour.transactionCount}`);
      }
    });

    console.log('\n--- Asset Performance ---');
    detailed.assetPerformance.forEach(asset => {
      console.log(`${asset.asset}: Volume ${asset.totalVolume}, Transactions: ${asset.transactionCount}`);
      if (asset.averageSlippage) {
        console.log(`  Average Slippage: ${asset.averageSlippage}`);
      }
    });

    console.log('\n--- Error Analysis ---');
    detailed.errorAnalysis.forEach(error => {
      console.log(`${error.error}: ${error.count} occurrences (${error.percentage})`);
    });

    // 4. Get raw transaction data
    console.log('\n4. Getting raw transaction data...\n');
    const transactions = agent.metrics.getTransactions({
      status: 'failed',
      limit: 10
    });

    console.log(`Found ${transactions.length} failed transactions:`);
    transactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type} at ${new Date(tx.timestamp).toISOString()} - ${tx.error?.message || 'Unknown error'}`);
    });

    // 5. Export analytics data
    console.log('\n5. Exporting analytics data...\n');
    const exportData = agent.metrics.export();
    console.log(`Exported ${exportData.length} characters of analytics data`);
    
    // You could save this to a file:
    // import fs from 'fs';
    // fs.writeFileSync('analytics-backup.json', exportData);
    // console.log('Analytics data saved to analytics-backup.json');

    // 6. Cleanup old data
    console.log('\n6. Cleaning up old data...\n');
    agent.metrics.cleanup();
    console.log('Cleanup completed');

    console.log('\n=== Analytics Example Complete ===');

  } catch (error) {
    console.error('Analytics example failed:', error);
  }
}

// Advanced usage examples
async function advancedAnalyticsExamples() {
  const agent = new AgentClient({
    network: "testnet",
    allowMainnet: false
  });

  console.log('=== Advanced Analytics Examples ===\n');

  // Example 1: Monitor performance in real-time
  console.log('1. Real-time Performance Monitoring');
  const checkPerformance = () => {
    const summary = agent.metrics.summary();
    
    // Alert if success rate drops below 95%
    const successRate = parseFloat(summary.successRate);
    if (successRate < 95) {
      console.log(`\u26a0\ufe0f Alert: Success rate dropped to ${summary.successRate}%`);
    }

    // Alert if average execution time is too high
    if (summary.averageExecutionTime > 5000) {
      console.log(`\u26a0\ufe0f Alert: Average execution time is ${summary.averageExecutionTime}ms (threshold: 5000ms)`);
    }

    // Alert if error rate is too high
    const errorRate = parseFloat(summary.insights.errorRate);
    if (errorRate > 5) {
      console.log(`\u26a0\ufe0f Alert: Error rate is ${summary.insights.errorRate} (threshold: 5%)`);
    }
  };

  // Example 2: Generate performance reports
  console.log('\n2. Performance Report Generation');
  const generateReport = () => {
    const summary = agent.metrics.summary();
    const detailed = agent.metrics.detailed();

    const report = {
      timestamp: new Date().toISOString(),
      overview: {
        totalTransactions: summary.totalTransactions,
        successRate: summary.successRate,
        totalVolume: summary.totalVolume,
        averageExecutionTime: summary.averageExecutionTime
      },
      swapPerformance: summary.swapMetrics,
      bridgePerformance: summary.bridgeMetrics,
      lpPerformance: summary.lpMetrics,
      topAssets: detailed.assetPerformance
        .sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume))
        .slice(0, 5),
      commonErrors: detailed.errorAnalysis
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
    };

    return report;
  };

  // Example 3: Performance optimization insights
  console.log('\n3. Performance Optimization Insights');
  const getOptimizationInsights = () => {
    const detailed = agent.metrics.detailed();
    const insights = [];

    // Find slow transactions
    const slowTransactions = detailed.recentTransactions
      .filter(tx => tx.executionTime > 3000)
      .sort((a, b) => b.executionTime - a.executionTime);

    if (slowTransactions.length > 0) {
      insights.push({
        type: 'performance',
        message: `Found ${slowTransactions.length} slow transactions (>3s). Consider optimizing gas settings or network conditions.`,
        transactions: slowTransactions.slice(0, 5)
      });
    }

    // Find high slippage trades
    const highSlippage = detailed.recentTransactions
      .filter(tx => tx.swapData && parseFloat(tx.swapData.slippage || '0') > 2)
      .sort((a, b) => parseFloat(b.swapData!.slippage!) - parseFloat(a.swapData!.slippage!));

    if (highSlippage.length > 0) {
      insights.push({
        type: 'trading',
        message: `Found ${highSlippage.length} trades with high slippage (>2%). Consider using limit orders or better routing.`,
        transactions: highSlippage.slice(0, 5)
      });
    }

    // Find recurring errors
    const recurringErrors = detailed.errorAnalysis
      .filter(error => error.count > 3);

    if (recurringErrors.length > 0) {
      insights.push({
        type: 'reliability',
        message: `Found ${recurringErrors.length} recurring error patterns. Consider investigating root causes.`,
        errors: recurringErrors
      });
    }

    return insights;
  };

  // Example 4: Custom filtering and analysis
  console.log('\n4. Custom Analytics Queries');
  
  // Get last 24 hours of activity
  const last24Hours = agent.metrics.getTransactions({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
  });

  console.log(`Transactions in last 24 hours: ${last24Hours.length}`);

  // Get failed swaps for debugging
  const failedSwaps = agent.metrics.getTransactions({
    type: 'swap',
    status: 'failed'
  });

  console.log(`Failed swaps: ${failedSwaps.length}`);

  // Get bridge transactions to specific chain
  const ethereumBridges = agent.metrics.getTransactions({
    type: 'bridge'
  }).filter(tx => tx.bridgeData?.toNetwork === 'ethereum');

  console.log(`Ethereum bridges: ${ethereumBridges.length}`);

  console.log('\n=== Advanced Examples Complete ===');
}

// Export the examples for use in other modules
export { analyticsExample, advancedAnalyticsExamples };

// If you want to run this example directly, you can:
// import { analyticsExample, advancedAnalyticsExamples } from './analytics-example.js';
// analyticsExample().then(() => advancedAnalyticsExamples()).catch(console.error);
