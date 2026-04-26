# Route Optimizer Documentation

## Overview

The Route Optimizer is a powerful feature of Stellar AgentKit that provides intelligent routing across multiple DEXes and liquidity pools to find the optimal execution path for swaps and liquidity operations. It analyzes available pools, compares rates, and selects the best route based on various strategies and user preferences.

## Features

### 🧠 Intelligent Routing
- **Multi-DEX Support**: Queries liquidity pools from Horizon and Soroban AMMs
- **Multi-Hop Routing**: Finds optimal paths through multiple intermediate assets
- **Real-time Pool Data**: Caches pool information for performance while maintaining freshness
- **Price Impact Calculation**: Estimates slippage and market impact for trades

### 📊 Strategy-Based Optimization
- **Best Route**: Maximizes output amount while considering confidence and hop count
- **Direct Route**: Prioritizes single-pool trades for simplicity and speed
- **Minimal Hops**: Reduces complexity by finding the shortest path
- **Split Route**: Distributes large trades across multiple routes

### ⚙️ Advanced Configuration
- **Slippage Tolerance**: Set acceptable price slippage in basis points
- **Hop Limits**: Control maximum number of intermediate assets
- **Pool Preferences**: Include/exclude specific pools
- **Confidence Scoring**: Route reliability assessment based on liquidity and complexity

## Quick Start

### Basic Usage

```typescript
import { AgentClient } from 'stellar-agentkit';

const agent = new AgentClient({
  network: 'testnet',
  publicKey: process.env.STELLAR_PUBLIC_KEY,
  allowMainnet: false
});

// Perform an optimized swap
const result = await agent.swap({
  strategy: "best-route",
  sendAsset: { type: "native" }, // XLM
  destAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" },
  sendAmount: "100",
  slippageBps: 100 // 1% slippage tolerance
});

console.log(`Swap executed: ${result.actualInput} XLM → ${result.actualOutput} USDC`);
console.log(`Route: ${result.route.hopCount} hops, confidence: ${(result.route.confidence * 100).toFixed(1)}%`);
```

### Advanced Usage

```typescript
// Advanced configuration with custom preferences
const result = await agent.swap({
  strategy: "best-route",
  sendAsset: { type: "native" },
  destAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" },
  sendAmount: "1000",
  slippageBps: 200, // 2% slippage
  maxHops: 3,
  excludePools: ["high_fee_pool_1"],
  preferPools: ["high_liquidity_pool"],
  destination: "GD...DESTINATION"
});
```

## API Reference

### Types

#### `SwapStrategy`
```typescript
type SwapStrategy = "best-route" | "direct" | "split" | "minimal-hops";
```

- **`best-route`**: Maximizes output amount while considering confidence and complexity
- **`direct`**: Prioritizes single-pool trades
- **`split`**: Distributes trades across multiple routes (for large trades)
- **`minimal-hops`**: Finds the shortest path between assets

#### `OptimizedSwapParams`
```typescript
interface OptimizedSwapParams {
  sendAsset: StellarAssetInput;
  destAsset: StellarAssetInput;
  sendAmount?: string;
  destAmount?: string;
  strategy: SwapStrategy;
  slippageBps?: number;
  maxHops?: number;
  splitRoutes?: number;
  excludePools?: string[];
  preferPools?: string[];
}
```

#### `OptimizedSwapResult`
```typescript
interface OptimizedSwapResult {
  route: RouteOption;
  transactionHash: string;
  actualInput: string;
  actualOutput: string;
  slippage: string;
  fees: string;
  executionTime: number;
}
```

#### `RouteOption`
```typescript
interface RouteOption {
  path: StellarAssetInput[];
  pools: PoolInfo[];
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  hopCount: number;
  totalFee: string;
  estimatedGas: string;
  confidence: number; // 0-1 score
}
```

### AgentClient Methods

#### `agent.swap(params)`
Execute an optimized swap using intelligent routing.

**Parameters:**
- `params`: `OptimizedSwapParams & { destination?: string }`

**Returns:** `Promise<OptimizedSwapResult>`

### RouteOptimizer Class

For advanced use cases, you can use the RouteOptimizer class directly:

```typescript
import { RouteOptimizer } from 'stellar-agentkit';

const optimizer = new RouteOptimizer({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  maxHops: 4,
  maxRoutes: 10,
  cacheTimeout: 30
});

// Find optimal route without executing
const route = await optimizer.findOptimalRoute({
  strategy: 'best-route',
  sendAsset: { type: 'native' },
  destAsset: { code: 'USDC', issuer: 'GB...' },
  sendAmount: '100'
});

// Execute the swap
const result = await optimizer.executeOptimizedSwap(
  { strategy: 'best-route', sendAsset, destAsset, sendAmount },
  destination,
  signerPublicKey
);
```

## Strategies Explained

### Best Route Strategy
The default strategy that balances multiple factors:
- **Output Amount**: Maximizes the amount received
- **Confidence**: Prefers routes with higher reliability scores
- **Hop Count**: Fewer hops are preferred for equal outputs
- **Liquidity**: Considers pool depth and price impact

Use when: You want the optimal balance of price and reliability.

### Direct Route Strategy
Prioritizes single-pool trades:
- **Simplicity**: Only considers direct pool trades
- **Speed**: Fewer transaction operations
- **Transparency**: Clear pricing from single source

Use when: You prefer simple, transparent trades or for smaller amounts.

### Minimal Hops Strategy
Finds the shortest path between assets:
- **Complexity**: Minimizes the number of intermediate assets
- **Gas Efficiency**: Fewer operations typically mean lower fees
- **Reliability**: Fewer points of failure

Use when: Gas efficiency is a priority or for complex asset pairs.

### Split Route Strategy
Distributes trades across multiple routes:
- **Large Trades**: Reduces price impact on single pools
- **Liquidity Access**: Taps into multiple sources
- **Risk Distribution**: Spreads execution across venues

Use when: Trading large amounts that might impact single pools.

## Configuration Options

### Slippage Tolerance
Control acceptable price slippage in basis points (bps):
- `100 bps = 1%`
- `50 bps = 0.5%`
- `200 bps = 2%`

```typescript
await agent.swap({
  // ... other params
  slippageBps: 100 // Accept 1% slippage
});
```

### Hop Limits
Control route complexity:
```typescript
await agent.swap({
  // ... other params
  maxHops: 2 // Maximum 2 intermediate assets
});
```

### Pool Preferences
Include or exclude specific pools:
```typescript
await agent.swap({
  // ... other params
  excludePools: ["high_fee_pool", "low_liquidity_pool"],
  preferPools: ["trusted_amm", "high_volume_pool"]
});
```

## Performance Considerations

### Caching
The route optimizer caches pool data to improve performance:
- **Default Cache Time**: 30 seconds
- **Automatic Refresh**: Stale data is automatically refreshed
- **Memory Efficient**: Cache size is limited and managed

### Network Requests
- **Pool Queries**: Batches requests to minimize API calls
- **Parallel Processing**: Multiple routes calculated simultaneously
- **Timeout Handling**: Robust error handling for network issues

### Gas Optimization
- **Route Estimation**: Pre-calculates gas costs for different routes
- **Fee Comparison**: Considers both pool fees and transaction fees
- **Efficient Paths**: Prefers gas-efficient routes when prices are similar

## Error Handling

### Common Errors

#### No Routes Available
```typescript
try {
  const result = await agent.swap(params);
} catch (error) {
  if (error.message.includes('No routes available')) {
    // Handle unsupported asset pair or insufficient liquidity
  }
}
```

#### High Price Impact
```typescript
const result = await agent.swap(params);
if (parseFloat(result.route.priceImpact) > 5) {
  console.warn('High price impact detected:', result.route.priceImpact + '%');
}
```

#### Network Errors
```typescript
try {
  const result = await agent.swap(params);
} catch (error) {
  if (error.message.includes('Network')) {
    // Retry with different strategy or parameters
  }
}
```

## Best Practices

### 1. Choose Appropriate Strategy
- **Small trades**: Use `direct` strategy for simplicity
- **Large trades**: Use `best-route` or `split` for better pricing
- **Complex pairs**: Use `minimal-hops` for reliability

### 2. Set Reasonable Slippage
- **Tight markets**: 10-50 bps (0.1-0.5%)
- **Normal markets**: 50-100 bps (0.5-1%)
- **Volatile markets**: 100-300 bps (1-3%)

### 3. Monitor Route Confidence
```typescript
const result = await agent.swap(params);
if (result.route.confidence < 0.7) {
  console.warn('Low confidence route, consider alternative strategy');
}
```

### 4. Handle Large Trades Carefully
```typescript
const amount = "10000"; // Large trade
if (parseFloat(amount) > 1000) {
  const result = await agent.swap({
    ...params,
    strategy: 'split',
    slippageBps: 200, // Higher tolerance for large trades
    splitRoutes: 3
  });
}
```

### 5. Use Metrics for Monitoring
```typescript
const result = await agent.swap(params);

// Check performance
const metrics = agent.metrics.summary();
console.log('Success rate:', metrics.successRate);
console.log('Average execution time:', metrics.avgExecutionTime);
```

## Integration Examples

### DeFi Application
```typescript
// Swap component for DeFi app
async function executeSwap(fromAsset, toAsset, amount) {
  try {
    const result = await agent.swap({
      strategy: 'best-route',
      sendAsset: fromAsset,
      destAsset: toAsset,
      sendAmount: amount,
      slippageBps: 100
    });

    // Update UI with results
    updateSwapResult(result);
    
    // Track metrics
    trackSwapPerformance(result);
    
  } catch (error) {
    handleSwapError(error);
  }
}
```

### Trading Bot
```typescript
// Automated trading with route optimization
async function tradingBot() {
  const strategy = 'best-route';
  const slippage = 50; // Tight slippage for bot
  
  for (const opportunity of tradingOpportunities) {
    try {
      const result = await agent.swap({
        strategy,
        sendAsset: opportunity.from,
        destAsset: opportunity.to,
        sendAmount: opportunity.amount,
        slippageBps: slippage,
        maxHops: 2 // Limit complexity for speed
      });
      
      if (parseFloat(result.route.priceImpact) < 2) {
        executeTrade(result);
      }
      
    } catch (error) {
      logTradingError(error, opportunity);
    }
  }
}
```

### Portfolio Rebalancing
```typescript
// Portfolio rebalancing with optimal routing
async function rebalancePortfolio(targetAllocation) {
  const rebalancingTrades = calculateTrades(targetAllocation);
  
  for (const trade of rebalancingTrades) {
    try {
      const result = await agent.swap({
        strategy: 'split', // Use split for large rebalancing trades
        sendAsset: trade.from,
        destAsset: trade.to,
        sendAmount: trade.amount,
        slippageBps: 150, // Moderate slippage for rebalancing
        splitRoutes: 4
      });
      
      updatePortfolio(result);
      
    } catch (error) {
      handleRebalancingError(error, trade);
    }
  }
}
```

## Troubleshooting

### Performance Issues
1. **Increase cache timeout** for frequently used pools
2. **Reduce maxHops** to limit search complexity
3. **Use direct strategy** for simpler routing

### Pricing Issues
1. **Check slippage settings** - too low can cause failures
2. **Verify pool liquidity** - low liquidity causes high impact
3. **Consider split strategy** for large trades

### Network Issues
1. **Implement retry logic** with exponential backoff
2. **Use fallback strategies** when primary fails
3. **Monitor network conditions** and adjust accordingly

## Future Enhancements

### Planned Features
- **MEV Protection**: Flashbot-style transaction ordering
- **Advanced Split Algorithms**: More sophisticated trade splitting
- **Cross-Chain Routing**: Bridge integration for multi-chain swaps
- **Dynamic Fee Adjustment**: Real-time gas price optimization
- **Yield Farming Integration**: Route through yield-generating pools

### Community Contributions
We welcome contributions to improve the route optimizer:
- **New Strategies**: Custom routing algorithms
- **Pool Sources**: Additional DEX integrations
- **Performance**: Optimization and caching improvements
- **Analytics**: Advanced routing analytics and insights

## Support

For questions, issues, or contributions:
- **Documentation**: Check this guide and code comments
- **Issues**: File GitHub issues with detailed descriptions
- **Discussions**: Join community discussions for ideas
- **Examples**: Review the examples directory for use cases
