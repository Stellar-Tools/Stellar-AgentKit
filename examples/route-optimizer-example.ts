/**
 * Route Optimizer Usage Example
 * 
 * This example demonstrates how to use the new route optimizer functionality
 * to perform intelligent swaps across multiple DEXes and liquidity pools.
 */

import { AgentClient, SwapStrategy } from '../agent';

async function demonstrateRouteOptimizer() {
  console.log("🚀 Route Optimizer Example");
  console.log("=".repeat(50));

  try {
    // Initialize AgentClient for testnet
    const agent = new AgentClient({
      network: "testnet",
      publicKey: process.env.STELLAR_PUBLIC_KEY || 'GB...TEST',
      allowMainnet: false,
    });

    console.log("✅ AgentClient initialized with route optimizer");

    // Example 1: Best Route Strategy
    console.log("\n📊 Example 1: Best Route Strategy");
    console.log("-".repeat(30));
    
    try {
      const bestRouteResult = await agent.swap({
        strategy: "best-route",
        sendAsset: { type: "native" }, // XLM
        destAsset: { 
          code: "USDC", 
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
        },
        sendAmount: "100",
        slippageBps: 100, // 1% slippage tolerance
        maxHops: 3
      });

      console.log("✅ Best route swap executed successfully!");
      console.log(`Transaction Hash: ${bestRouteResult.transactionHash}`);
      console.log(`Route: ${bestRouteResult.route.path.map(a => {
        if ('type' in a) {
          return 'XLM';
        } else {
          const issuedAsset = a as { code: string; issuer: string };
          return `${issuedAsset.code}:${issuedAsset.issuer.slice(0, 8)}...`;
        }
      }).join(' → ')}`);
      console.log(`Input: ${bestRouteResult.actualInput} XLM`);
      console.log(`Output: ${bestRouteResult.actualOutput} USDC`);
      console.log(`Price Impact: ${bestRouteResult.route.priceImpact}%`);
      console.log(`Hop Count: ${bestRouteResult.route.hopCount}`);
      console.log(`Confidence: ${(bestRouteResult.route.confidence * 100).toFixed(1)}%`);
      console.log(`Execution Time: ${bestRouteResult.executionTime}ms`);
      
    } catch (error) {
      console.log("❌ Best route swap failed (expected in demo):", 
        error instanceof Error ? error.message : String(error));
    }

    // Example 2: Direct Route Strategy
    console.log("\n🎯 Example 2: Direct Route Strategy");
    console.log("-".repeat(30));
    
    try {
      const directResult = await agent.swap({
        strategy: "direct",
        sendAsset: { type: "native" },
        destAsset: { 
          code: "USDC", 
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
        },
        sendAmount: "50",
        slippageBps: 50 // 0.5% slippage
      });

      console.log("✅ Direct route swap executed!");
      console.log(`Hops: ${directResult.route.hopCount} (should be 1)`);
      console.log(`Output: ${directResult.actualOutput} USDC`);
      
    } catch (error) {
      console.log("❌ Direct route swap failed (expected in demo):", 
        error instanceof Error ? error.message : String(error));
    }

    // Example 3: Minimal Hops Strategy
    console.log("\n⚡ Example 3: Minimal Hops Strategy");
    console.log("-".repeat(30));
    
    try {
      const minimalHopsResult = await agent.swap({
        strategy: "minimal-hops",
        sendAsset: { type: "native" },
        destAsset: { 
          code: "ETH", 
          issuer: "GBDEVU73PYK7BQFCXLF5UVJ2Z3T5R7B6CZ4SPEN5YJP6PUDJQ5EELBCP" 
        },
        sendAmount: "25",
        maxHops: 4
      });

      console.log("✅ Minimal hops swap executed!");
      console.log(`Hops: ${minimalHopsResult.route.hopCount}`);
      console.log(`Route: ${minimalHopsResult.route.path.length} assets`);
      
    } catch (error) {
      console.log("❌ Minimal hops swap failed (expected in demo):", 
        error instanceof Error ? error.message : String(error));
    }

    // Example 4: Split Strategy (for large trades)
    console.log("\n💰 Example 4: Split Strategy");
    console.log("-".repeat(30));
    
    try {
      const splitResult = await agent.swap({
        strategy: "split",
        sendAsset: { type: "native" },
        destAsset: { 
          code: "USDC", 
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
        },
        sendAmount: "1000", // Large trade
        splitRoutes: 3, // Split across 3 routes
        slippageBps: 200 // 2% slippage for large trade
      });

      console.log("✅ Split strategy swap executed!");
      console.log(`Large trade: ${splitResult.actualInput} XLM`);
      console.log(`Output: ${splitResult.actualOutput} USDC`);
      
    } catch (error) {
      console.log("❌ Split strategy swap failed (expected in demo):", 
        error instanceof Error ? error.message : String(error));
    }

    // Example 5: Advanced Configuration with Pool Preferences
    console.log("\n⚙️ Example 5: Advanced Configuration");
    console.log("-".repeat(30));
    
    try {
      const advancedResult = await agent.swap({
        strategy: "best-route",
        sendAsset: { type: "native" },
        destAsset: { 
          code: "USDC", 
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
        },
        sendAmount: "75",
        slippageBps: 75,
        maxHops: 2,
        // Exclude certain pools (example)
        excludePools: ["pool_1", "pool_2"],
        // Prefer certain pools (example)
        preferPools: ["high_liquidity_pool"],
        destination: "GD...DESTINATION" // Different destination
      });

      console.log("✅ Advanced configuration swap executed!");
      console.log(`Custom destination used`);
      console.log(`Pool preferences applied`);
      
    } catch (error) {
      console.log("❌ Advanced swap failed (expected in demo):", 
        error instanceof Error ? error.message : String(error));
    }

    // Example 6: Compare Strategies
    console.log("\n📈 Example 6: Strategy Comparison");
    console.log("-".repeat(30));
    
    const strategies: SwapStrategy[] = ["best-route", "direct", "minimal-hops"];
    const results: Array<{ strategy: SwapStrategy; result?: any; error?: string }> = [];

    for (const strategy of strategies) {
      try {
        const result = await agent.swap({
          strategy,
          sendAsset: { type: "native" },
          destAsset: { 
            code: "USDC", 
            issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
          },
          sendAmount: "10"
        });
        results.push({ strategy, result });
      } catch (error) {
        results.push({ 
          strategy, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    console.log("Strategy Comparison Results:");
    results.forEach(({ strategy, result, error }) => {
      if (error) {
        console.log(`❌ ${strategy}: Failed - ${error}`);
      } else {
        console.log(`✅ ${strategy}: ${result.route.hopCount} hops, ${result.actualOutput} output`);
      }
    });

    console.log("\n🎉 Route optimizer demonstration completed!");

  } catch (error: unknown) {
    console.error("\n❌ Route optimizer demo failed:");
    console.error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Real-world usage example
 */
async function realWorldUsage() {
  console.log("\n🌍 Real-World Usage Example");
  console.log("=".repeat(50));

  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY!,
    allowMainnet: false,
  });

  try {
    // Scenario: User wants to swap XLM to USDC for the best rate
    console.log("💡 Scenario: User wants to swap XLM to USDC at the best rate");
    
    const result = await agent.swap({
      strategy: "best-route",
      sendAsset: { type: "native" },
      destAsset: { 
        code: "USDC", 
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
      },
      sendAmount: "500", // 500 XLM
      slippageBps: 100, // 1% slippage tolerance
      maxHops: 3
    });

    console.log("✅ Trade executed successfully!");
    console.log(`📊 Route Analysis:`);
    console.log(`   - Path: ${result.route.path.length} assets`);
    console.log(`   - Hops: ${result.route.hopCount}`);
    console.log(`   - Confidence: ${(result.route.confidence * 100).toFixed(1)}%`);
    console.log(`   - Price Impact: ${result.route.priceImpact}%`);
    console.log(`   - Fees: ${result.fees}`);
    
    console.log(`💰 Trade Results:`);
    console.log(`   - Input: ${result.actualInput} XLM`);
    console.log(`   - Output: ${result.actualOutput} USDC`);
    console.log(`   - Rate: ${parseFloat(result.actualOutput) / parseFloat(result.actualInput)} USDC/XLM`);
    console.log(`   - Slippage: ${result.slippage}%`);
    console.log(`   - Execution Time: ${result.executionTime}ms`);

    // Check metrics
    const metrics = agent.metrics.summary();
    console.log(`📈 Updated Metrics:`);
    console.log(`   - Total Volume: ${metrics.totalVolume}`);
    console.log(`   - Success Rate: ${metrics.successRate}`);
    console.log(`   - Average Execution Time: ${metrics.avgExecutionTime}`);

  } catch (error: unknown) {
    console.error("❌ Real-world example failed:", 
      error instanceof Error ? error.message : String(error));
  }
}

/**
 * Performance testing example
 */
async function performanceTest() {
  console.log("\n⚡ Performance Testing");
  console.log("=".repeat(50));

  const agent = new AgentClient({
    network: "testnet",
    allowMainnet: false,
  });

  const strategies: SwapStrategy[] = ["best-route", "direct", "minimal-hops"];
  const testAmount = "100";
  
  for (const strategy of strategies) {
    console.log(`\n🧪 Testing ${strategy} strategy...`);
    
    const times: number[] = [];
    const iterations = 3;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        
        await agent.swap({
          strategy,
          sendAsset: { type: "native" },
          destAsset: { 
            code: "USDC", 
            issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" 
          },
          sendAmount: testAmount
        });
        
        const executionTime = Date.now() - startTime;
        times.push(executionTime);
        
        console.log(`  Iteration ${i + 1}: ${executionTime}ms`);
        
      } catch (error) {
        console.log(`  Iteration ${i + 1}: Failed - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`📊 ${strategy} Performance:`);
      console.log(`   Average: ${avgTime.toFixed(0)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);
      console.log(`   Success Rate: ${(times.length / iterations * 100).toFixed(0)}%`);
    }
  }
}

// Run the demonstrations
if (require.main === module) {
  demonstrateRouteOptimizer()
    .then(() => realWorldUsage())
    .then(() => performanceTest())
    .catch(console.error);
}

export { 
  demonstrateRouteOptimizer, 
  realWorldUsage, 
  performanceTest 
};
