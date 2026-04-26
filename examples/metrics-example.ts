import { AgentClient } from '../agent';

async function demonstrateMetrics() {
  // Initialize the agent client
  const agent = new AgentClient({
    network: 'testnet',
    publicKey: process.env.STELLAR_PUBLIC_KEY || 'GB...TEST',
    allowMainnet: false,
  });

  console.log('🚀 Demonstrating Stellar AgentKit Metrics Analytics\n');

  try {
    // Example 1: Get initial metrics summary
    console.log('📊 Initial Metrics Summary:');
    const initialSummary = agent.metrics.summary();
    console.log(JSON.stringify(initialSummary, null, 2));
    console.log('\n');

    // Example 2: Perform some transactions to generate metrics
    console.log('🔄 Performing transactions to generate metrics...\n');

    // Note: These are example calls - in a real scenario, you'd need proper
    // account setup and valid parameters for these transactions to succeed

    try {
      // Example swap (this would fail without proper setup, but will still generate metrics)
      console.log('⚡ Attempting swap...');
      await agent.swap({
        to: 'GD...TEST_DESTINATION',
        buyA: true,
        out: '10',
        inMax: '11',
        contractAddress: 'CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ',
      });
    } catch (error) {
      console.log('Swap failed (expected in demo):', error instanceof Error ? error.message : String(error));
    }

    try {
      // Example bridge
      console.log('⚡ Attempting bridge...');
      await agent.bridge({
        amount: '100',
        toAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45',
        targetChain: 'ethereum',
      });
    } catch (error) {
      console.log('Bridge failed (expected in demo):', error instanceof Error ? error.message : String(error));
    }

    try {
      // Example LP deposit
      console.log('⚡ Attempting LP deposit...');
      await agent.lp.deposit({
        to: 'GD...TEST_LP',
        desiredA: '50',
        minA: '45',
        desiredB: '50',
        minB: '45',
        contractAddress: 'CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ',
      });
    } catch (error) {
      console.log('LP deposit failed (expected in demo):', error instanceof Error ? error.message : String(error));
    }

    console.log('\n');

    // Example 3: Get updated metrics summary
    console.log('📊 Updated Metrics Summary:');
    const updatedSummary = agent.metrics.summary();
    console.log(JSON.stringify(updatedSummary, null, 2));
    console.log('\n');

    // Example 4: Get recent transactions
    console.log('📋 Recent Transactions:');
    const recentTransactions = agent.metrics.getTransactions(5);
    recentTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type.toUpperCase()} - ${tx.status} - ${tx.amount || 'N/A'} - ${new Date(tx.timestamp).toISOString()}`);
    });
    console.log('\n');

    // Example 5: Filter transactions by type
    console.log('🔍 Swap Transactions Only:');
    const swapTransactions = agent.metrics.getTransactions(undefined, 'swap');
    swapTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type.toUpperCase()} - ${tx.status} - Execution Time: ${tx.executionTime || 'N/A'}ms`);
    });
    console.log('\n');

    // Example 6: Get transactions from last 24 hours
    console.log('📅 Transactions from Last 24 Hours:');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();
    const recentTxs = agent.metrics.getTransactionsByDateRange(yesterday, now);
    console.log(`Found ${recentTxs.length} transactions in the last 24 hours\n`);

    // Example 7: Export metrics for external analysis
    console.log('💾 Exporting metrics for external analysis...');
    const exportedMetrics = agent.metrics.export();
    console.log(`Exported ${exportedMetrics.length} transactions\n`);

    // Example 8: Performance insights
    console.log('🎯 Performance Insights:');
    const summary = agent.metrics.summary();
    console.log(`- Total Volume: ${summary.totalVolume}`);
    console.log(`- Success Rate: ${summary.successRate}`);
    console.log(`- Average Execution Time: ${summary.avgExecutionTime}`);
    console.log(`- Average Slippage: ${summary.avgSlippage}`);
    
    if (summary.performanceMetrics) {
      console.log(`- Fastest Execution: ${summary.performanceMetrics.fastestExecution}`);
      console.log(`- Slowest Execution: ${summary.performanceMetrics.slowestExecution}`);
      console.log(`- Average Gas Used: ${summary.performanceMetrics.avgGasUsed}`);
    }

    if (summary.chainBreakdown) {
      console.log('\n🌐 Chain Breakdown:');
      Object.entries(summary.chainBreakdown).forEach(([chain, count]) => {
        console.log(`- ${chain}: ${count} transactions`);
      });
    }

    if (summary.assetBreakdown) {
      console.log('\n💰 Asset Breakdown:');
      Object.entries(summary.assetBreakdown).forEach(([asset, count]) => {
        console.log(`- ${asset}: ${count} transactions`);
      });
    }

    console.log('\n✅ Metrics demonstration completed!');

  } catch (error) {
    console.error('❌ Error in metrics demonstration:', error);
  }
}

// Example usage in a real application
async function realWorldUsage() {
  const agent = new AgentClient({
    network: 'testnet',
    publicKey: process.env.STELLAR_PUBLIC_KEY!,
    allowMainnet: false,
  });

  // Monitor transaction performance in real-time
  console.log('📈 Real-time Transaction Monitoring');
  
  // Perform a swap
  try {
    const swapResult = await agent.swap({
      to: 'GD...DESTINATION',
      buyA: true,
      out: '100',
      inMax: '110',
    });

    console.log('✅ Swap successful:', swapResult);
    
    // Immediately check metrics
    const summary = agent.metrics.summary();
    console.log(`📊 Current Success Rate: ${summary.successRate}`);
    console.log(`⚡ Average Execution Time: ${summary.avgExecutionTime}`);
    
  } catch (error) {
    console.error('❌ Swap failed:', error);
    
    // Check failure rate
    const summary = agent.metrics.summary();
    console.log(`📊 Current Success Rate: ${summary.successRate}`);
    
    // Get recent failed transactions for debugging
    const recentTxs = agent.metrics.getTransactions(10);
    const failedTxs = recentTxs.filter(tx => tx.status === 'failed');
    
    if (failedTxs.length > 0) {
      console.log('\n🐛 Recent Failed Transactions:');
      failedTxs.forEach(tx => {
        console.log(`- ${tx.type} at ${new Date(tx.timestamp).toISOString()}: ${tx.errorMessage}`);
      });
    }
  }

  // Generate daily report
  console.log('\n📋 Daily Performance Report');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayTransactions = agent.metrics.getTransactionsByDateRange(today, tomorrow);
  
  // Calculate today's metrics from today's transactions
  const todayVolume = todayTransactions
    .filter(tx => tx.status === 'success')
    .reduce((sum, tx) => sum + (parseFloat(tx.amount || '0') || 0), 0);
  const todaySuccessRate = todayTransactions.length > 0 
    ? ((todayTransactions.filter(tx => tx.status === 'success').length / todayTransactions.length) * 100).toFixed(2) + '%'
    : '0%';
  
  console.log(`Transactions today: ${todayTransactions.length}`);
  console.log(`Volume today: ${todayVolume.toString()}`);
  console.log(`Success rate today: ${todaySuccessRate}`);
  
  // Export data for dashboard
  const dashboardData = agent.metrics.export();
  // Send dashboardData to your dashboard service
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateMetrics().catch(console.error);
}

export { demonstrateMetrics, realWorldUsage };
