# Stellar AgentKit 🌟

[![Tests](https://github.com/Stellar-Tools/Stellar-AgentKit/actions/workflows/test.yml/badge.svg)](https://github.com/Stellar-Tools/Stellar-AgentKit/actions/workflows/test.yml)
[![Code Coverage](https://github.com/Stellar-Tools/Stellar-AgentKit/actions/workflows/coverage.yml/badge.svg)](https://github.com/Stellar-Tools/Stellar-AgentKit/actions/workflows/coverage.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


Stellar AgentKit is an open-source SDK and platform for interacting with the Stellar blockchain,
providing a unified agent to perform complex DeFi operations such as swaps, bridges, and liquidity
pool (LP) actions.

Built for both developers and end users, AgentKit simplifies Stellar-based DeFi by consolidating
multiple operations into a single programmable and extensible toolkit.

---

## ✨ Features

- ** Intelligent Route Optimizer** - Multi-DEX routing with best price discovery
- Token swaps on Stellar with optimal routing
- Cross-chain bridging
- Liquidity pool (LP) deposits & withdrawals
- Querying pool reserves and share IDs
- **🔮 Pre-execution Simulation** - Test transactions safely without spending real funds
- ** Transaction analytics and performance metrics**
- Historical tracking and debugging visibility
- Risk analytics and insights
- Custom contract integrations (current)
- Designed for future LP provider integrations
- Supports Testnet & Mainnet

---

## 🧠 What is AgentKit?

AgentKit abstracts complex Stellar operations into a **single agent interface** that can be:

- Embedded by developers into dApps
- Used by consumers via a user-friendly platform
- Extended with new contracts, tools, and workflows

This repository contains the **core SDK**, including utilities such as `stellarTools`.

---

## 📦 Installation
```bash
npm i stellartools
```

or

```bash
bun add stellartools
```

---

## 🚀 Quick Start

### Testnet (Safe for Testing)

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet",
});

await agent.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "110"
});
```

### Mainnet (Real Funds - Requires Explicit Opt-in)

⚠️ **Safety Notice:** Mainnet operations require the `allowMainnet: true` flag to prevent accidental execution with real funds.

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true, // ⚠️ Required for mainnet
  publicKey: process.env.STELLAR_PUBLIC_KEY
});

await agent.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "110"
});
```

**Without the `allowMainnet` flag, you'll receive an error:**
```
🚫 Mainnet execution blocked for safety.
Stellar AgentKit requires explicit opt-in for mainnet operations to prevent accidental use of real funds.
To enable mainnet, set allowMainnet: true in your config.
```

---

## 🔄 Swap Tokens

Perform token swaps on the Stellar network.

### 🧠 Intelligent Route Optimizer

The new route optimizer provides intelligent routing across multiple DEXes and liquidity pools to find the best execution path for your swaps.

```typescript
// Basic optimized swap
const result = await agent.swapOptimized({
  strategy: "best-route",
  sendAsset: { type: "native" }, // XLM
  destAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTBEVCH7NDLF6DIESJAHISV" },
  sendAmount: "100",
  slippageBps: 100 // 1% slippage tolerance
});

console.log(`Swap executed: ${result.actualInput} XLM → ${result.actualOutput} USDC`);
console.log(`Route: ${result.route.hopCount} hops, confidence: ${(result.route.confidence * 100).toFixed(1)}%`);
```

**Available Strategies:**
- `"best-route"` - Maximizes output while considering reliability
- `"direct"` - Prioritizes single-pool trades
- `"minimal-hops"` - Finds shortest path between assets
- `"split"` - Distributes large trades across multiple routes

**Advanced Configuration:**
```typescript
const result = await agent.swapOptimized({
  strategy: "best-route",
  sendAsset: { type: "native" },
  destAsset: { code: "USDC", issuer: "GB..." },
  sendAmount: "1000",
  slippageBps: 200, // 2% slippage
  maxHops: 3,
  excludePools: ["high_fee_pool"],
  preferPools: ["trusted_amm"]
});
```

### Best-Route Swaps on Stellar Classic

`agent.dex.*` is the new route-aware swap surface. It uses Horizon pathfinding plus
Stellar path payment operations, so the chosen route can traverse the SDEX and the
built-in liquidity pools automatically.

`quoteSwap({ limit })` returns up to `limit` ranked quotes to the caller. Internally,
the SDK fetches a fixed Horizon candidate window and then returns the top-ranked
results from that window.

`swapBestRoute()` requires `STELLAR_PRIVATE_KEY` to correspond to the same account
as the configured `publicKey`.

Implementation details:

- `strict-send` quotes are requested with explicit `destination_assets`, so the SDK asks Horizon for the requested output asset directly instead of discovering generic recipient assets and filtering later.
- Before quoting issued-asset outputs, the SDK checks that the destination account has the required trustline.
- Quotes are ranked by best output for `strict-send` and lowest input for `strict-receive`, with shorter paths as the tie-breaker.
- Execution builds a Stellar Classic path payment, then signs it only if `STELLAR_PRIVATE_KEY` matches the configured source account.

```typescript
const quotes = await agent.dex.quoteSwap({
  mode: "strict-send",
  sendAsset: { code: "USDC", issuer: "G..." },
  destAsset: { code: "EURC", issuer: "G..." },
  sendAmount: "25.0000000"
});

const result = await agent.dex.swapBestRoute({
  mode: "strict-send",
  sendAsset: { code: "USDC", issuer: "G..." },
  destAsset: { code: "EURC", issuer: "G..." },
  sendAmount: "25.0000000",
  slippageBps: 100
});
```

`quoteSwap()` returns ranked routes with normalized `path`, `sendAmount`,
`destAmount`, `estimatedPrice`, `hopCount`, and the raw Horizon path object.

`swapBestRoute()` executes the top-ranked route using:

- `PathPaymentStrictSend` for `mode: "strict-send"`
- `PathPaymentStrictReceive` for `mode: "strict-receive"`

### Legacy Soroban Single-Pool Swap

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet",
  publicKey: "YOUR_TESTNET_PUBLIC_KEY"
});

await agent.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "110"
});
```

This older `agent.swap()` method is a direct Soroban contract call against a
single configured pool. It is separate from `agent.dex.*` and should not be
treated as the best-route swap API.

---

## 🌉 Bridge Tokens

AgentKit supports cross-chain bridging between Stellar and EVM-compatible chains (Ethereum).

### Testnet Bridge (Default)

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet",
  publicKey: "YOUR_TESTNET_PUBLIC_KEY"
});

await agent.bridge({
  amount: "100",
  toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
});
```

### Mainnet Bridge

⚠️ **Warning:** Bridging on mainnet uses real funds and transactions are **irreversible**.

**Dual-Safeguard System:**

Mainnet bridging requires **BOTH** safeguards to be enabled:

1. **AgentClient Configuration:** `allowMainnet: true`
2. **Environment Variable:** `ALLOW_MAINNET_BRIDGE=true`

This dual-layer approach prevents accidental mainnet bridging.

**Environment Setup:**

Create a `.env` file with the following:

```bash
# Required for mainnet bridging
STELLAR_PUBLIC_KEY=your_mainnet_public_key
STELLAR_PRIVATE_KEY=your_mainnet_private_key
ALLOW_MAINNET_BRIDGE=true
SRB_PROVIDER_URL=https://soroban.stellar.org
```

**Usage:**

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true, // ⚠️ First safeguard
  publicKey: process.env.STELLAR_PUBLIC_KEY
});

// This will also check ALLOW_MAINNET_BRIDGE=true in .env
await agent.bridge({
  amount: "100",
  toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
});
```

**Response Format:**

```typescript
{
  status: "confirmed",           // or "pending", "pending_restore", "trustline_submitted"
  hash: "transaction_hash",
  network: "stellar-mainnet",    // or "stellar-testnet"
  asset: "USDC",
  amount: "100"
}
```

**Possible Status Values:**

- `confirmed` - Bridge transaction successful
- `pending` - Transaction submitted but not yet confirmed
- `pending_restore` - Restore transaction pending
- `trustline_submitted` - Trustline setup transaction submitted

**Error Scenarios:**

```typescript
// Missing allowMainnet flag
const agent = new AgentClient({
  network: "mainnet"
  // allowMainnet: true is missing
});
// Throws: "🚫 Mainnet execution blocked for safety..."

// Missing ALLOW_MAINNET_BRIDGE env var
const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true
});
await agent.bridge({ ... });
// Throws: "Mainnet bridging is disabled. Set ALLOW_MAINNET_BRIDGE=true in your .env file to enable."
```

**Best Practices:**

- ✅ Always test on testnet first
- ✅ Start with small amounts on mainnet
- ✅ Verify destination address multiple times
- ✅ Keep `ALLOW_MAINNET_BRIDGE` disabled by default in your `.env`
- ✅ Bridge operations are irreversible - double-check all parameters
- ✅ Both safeguards must be enabled for mainnet bridging

**Supported Routes:**

- Stellar Testnet → Ethereum (Testnet)
- Stellar Mainnet → Ethereum (Mainnet) *requires both `allowMainnet: true` and `ALLOW_MAINNET_BRIDGE=true`*

---

## 🔮 Pre-execution Simulation

**NEW:** Test transactions safely without spending real funds! The simulation feature allows you to validate transaction parameters, estimate fees, and catch errors before executing real transactions.

### Why Use Simulation?

- 🛡️ **Safety First** - Test parameters without risking real funds
- 💰 **Cost Estimation** - See fees and gas costs upfront
- 🐛 **Error Detection** - Catch issues before they cost you money
- ⏱️ **Timing Insights** - Understand execution time requirements
- 📊 **Transaction Details** - Full visibility into what will happen

### Basic Usage

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet", // or "mainnet" with allowMainnet: true
});

// Simulate a swap before execution
const swapSimulation = await agent.simulate.swap({
  to: "GD5DJQD5YFHR6CHCK7L4EZK3I2E5DSYXW4AFK5WGPDXN5RBTCEQYV5A4",
  buyA: true,
  out: "100",
  inMax: "105"
});

if (swapSimulation.success) {
  console.log("✅ Swap simulation successful!");
  console.log(`Estimated fee: ${swapSimulation.transactionDetails?.fee}`);
  
  // Execute with confidence
  await agent.swap({
    to: "GD5DJQD5YFHR6CHCK7L4EZK3I2E5DSYXW4AFK5WGPDXN5RBTCEQYV5A4",
    buyA: true,
    out: "100", 
    inMax: "105"
  });
} else {
  console.log("❌ Simulation failed:", swapSimulation.error);
}
```

### Swap Simulation

```typescript
const swapSim = await agent.simulate.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "105",
  contractAddress: "optional_contract_address"
});

// Response format
{
  status: "simulated",
  success: true,
  minResourceFee: "0.01",
  cost: { cpu: 1000, memory: 2000 },
  events: 2,
  result: "expected_output",
  transactionDetails: {
    operations: 1,
    fee: "0.01"
  }
}
```

### Bridge Simulation

```typescript
const bridgeSim = await agent.simulate.bridge({
  amount: "100",
  toAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
  targetChain: "ethereum" // or "polygon", "arbitrum", "base"
});

// Response format
{
  status: "simulated",
  success: true,
  result: {
    amount: "100",
    fromAddress: "your_stellar_address",
    toAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
    targetChain: "ethereum",
    estimatedFee: "0.002 ETH",
    estimatedTimeMinutes: "15-30",
    requiresTrustline: true
  },
  transactionDetails: {
    operations: 2,
    fee: "0.002"
  }
}
```

### Liquidity Pool Simulation

```typescript
// Simulate LP deposit
const depositSim = await agent.simulate.lp({
  operation: "deposit",
  to: "recipient_address",
  desiredA: "50",
  minA: "45", 
  desiredB: "50",
  minB: "45"
});

// Simulate LP withdrawal
const withdrawSim = await agent.simulate.lp({
  operation: "withdraw",
  to: "recipient_address",
  shareAmount: "100",
  minA: "40",
  minB: "40"
});
```

### Multi-Chain Bridge Comparison

```typescript
const chains = ["ethereum", "polygon", "arbitrum", "base"] as const;

for (const chain of chains) {
  const sim = await agent.simulate.bridge({
    amount: "50",
    toAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
    targetChain: chain
  });
  
  if (sim.success) {
    console.log(`${chain}: ${sim.result?.estimatedFee}, ${sim.result?.estimatedTimeMinutes} min`);
  }
}
```

### Error Handling

```typescript
const sim = await agent.simulate.swap({
  to: "invalid_address", // Invalid format
  buyA: true,
  out: "100",
  inMax: "105"
});

if (!sim.success) {
  console.log("Simulation caught error:", sim.error);
  // "Invalid address format: invalid_address"
}
```

### Best Practices

- ✅ **Always simulate before executing** on mainnet
- ✅ **Check simulation success** before proceeding
- ✅ **Review estimated fees** to avoid surprises
- ✅ **Validate addresses** in simulation first
- ✅ **Test edge cases** with invalid parameters
- ✅ **Use simulation for debugging** failed transactions

### Integration Example

```typescript
async function safeSwap(params: SwapParams) {
  // 1. Simulate first
  const sim = await agent.simulate.swap(params);
  
  if (!sim.success) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  
  // 2. Check if acceptable
  if (parseFloat(sim.transactionDetails?.fee || "0") > 0.1) {
    throw new Error("Fee too high");
  }
  
  // 3. Execute with confidence
  return await agent.swap(params);
}
```

---

## 💧 Liquidity Pool Operations

The existing `agent.lp.*` and `agent.swap()` methods below are the older
single-pool Soroban contract integrations. They are separate from the new
Classic DEX route optimizer.

### Deposit Liquidity

```typescript
await agent.lp.deposit({
  to: "recipient_address",
  desiredA: "1000",
  minA: "950",
  desiredB: "1000",
  minB: "950"
});
```

### Withdraw Liquidity

```typescript
await agent.lp.withdraw({
  to: "recipient_address",
  shareAmount: "100",
  minA: "95",
  minB: "95"
});
```

### Query Pool Information

```typescript
// Get current reserves
const reserves = await agent.lp.getReserves();

// Get share token ID
const shareId = await agent.lp.getShareId();
```

---

## 📊 Transaction Analytics & Performance Metrics

AgentKit now includes comprehensive transaction analytics and performance metrics to provide insights into your DeFi operations.

### 🎯 Key Features

- **Historical Tracking**: All transactions are automatically tracked with timestamps, execution times, and status
- **Performance Insights**: Monitor execution times, success rates, and gas usage patterns
- **Risk Analytics**: Track failed transactions, error patterns, and slippage metrics
- **Debugging Visibility**: Get detailed transaction data for troubleshooting

### 📈 Metrics Summary API

Get a comprehensive overview of your transaction performance:

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet",
  publicKey: "YOUR_PUBLIC_KEY"
});

// Perform some transactions first...
await agent.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "110"
});

// Get metrics summary
const summary = agent.metrics.summary();
console.log(summary);
// {
//   totalVolume: "10000",
//   avgSlippage: "1.2%",
//   successRate: "98%",
//   totalTransactions: 25,
//   avgExecutionTime: "1250ms",
//   transactionTypes: {
//     swaps: 15,
//     bridges: 5,
//     deposits: 3,
//     withdrawals: 2
//   },
//   statusBreakdown: {
//     success: 24,
//     failed: 1,
//     pending: 0
//   },
//   performanceMetrics: {
//     avgGasUsed: "1250",
//     avgGasPrice: "0.15",
//     fastestExecution: "800ms",
//     slowestExecution: "2100ms"
//   }
// }
```

### 🔍 Transaction History

Access detailed transaction history with filtering options:

```typescript
// Get recent transactions
const recentTxs = agent.metrics.getTransactions(10);

// Filter by transaction type
const swaps = agent.metrics.getTransactions(undefined, 'swap');
const bridges = agent.metrics.getTransactions(undefined, 'bridge');

// Get transactions from specific date range
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const today = new Date();
const todayTxs = agent.metrics.getTransactionsByDateRange(yesterday, today);
```

### 📊 Use Cases

#### Dashboard Integration
```typescript
// Export metrics for external dashboard
const dashboardData = agent.metrics.export();
// Send to your monitoring service
```

#### Performance Monitoring
```typescript
// Monitor real-time performance
const summary = agent.metrics.summary();
if (parseFloat(summary.successRate) < 95) {
  console.warn('Success rate below threshold:', summary.successRate);
}
```

#### Debugging Failed Transactions
```typescript
// Get recent failed transactions for debugging
const recentTxs = agent.metrics.getTransactions(20);
const failedTxs = recentTxs.filter(tx => tx.status === 'failed');

failedTxs.forEach(tx => {
  console.log(`Failed ${tx.type} at ${new Date(tx.timestamp).toISOString()}: ${tx.errorMessage}`);
});
```

#### Risk Analysis
```typescript
// Analyze risk patterns
const summary = agent.metrics.summary();
console.log(`Total volume: ${summary.totalVolume}`);
console.log(`Average slippage: ${summary.avgSlippage}`);
console.log(`Success rate: ${summary.successRate}`);

// Check chain breakdown for bridges
if (summary.chainBreakdown) {
  Object.entries(summary.chainBreakdown).forEach(([chain, count]) => {
    console.log(`${chain}: ${count} bridge transactions`);
  });
}
```

### 💾 Data Persistence

Metrics are automatically persisted to `~/.stellartools/metrics-{network}.json` and survive application restarts. You can also export/import metrics for backup or analysis:

```typescript
// Export all metrics
const allMetrics = agent.metrics.export();

// Import metrics (useful for backup/restore)
agent.metrics.import(allMetrics);

// Clear all metrics
agent.metrics.clear();
```

---

## 🌐 Supported Networks

- **Testnet** - Full support, no restrictions, safe for development
- **Mainnet** - Supported with caveats:
  - **Classic best-route swaps (`agent.dex.*`):** Require `allowMainnet: true` in `AgentClient`
  - **Soroban single-pool swap/LP (`agent.swap()`, `agent.lp.*`):** Still wired to testnet-only contract settings
  - **Bridge operations:** Require BOTH `allowMainnet: true` AND `ALLOW_MAINNET_BRIDGE=true` in `.env`

---

## 🧪 Testing

```bash
# Run test suite
node test/bridge-tests.mjs

# View test results
# ✅ 20/20 tests passed
# ✅ 100% success rate
```

---

## 🛡️ Security & Safety

### Mainnet Safeguards

AgentKit implements multiple layers of protection against accidental mainnet usage:

1. **AgentClient Level:** Requires explicit `allowMainnet: true` flag
2. **Bridge Level:** Additional `ALLOW_MAINNET_BRIDGE=true` environment variable check
3. **Console Warnings:** Clear warnings when mainnet is active
4. **Error Messages:** Descriptive error messages guide users to correct configuration

### Why Dual Safeguards for Bridge?

Bridging operations are **irreversible** and involve **cross-chain transfers**. The dual-safeguard approach ensures:

- Developers must consciously enable mainnet at both configuration and environment levels
- Reduces risk of accidental mainnet bridging due to misconfiguration
- Provides clear separation between general mainnet operations and high-risk bridge operations

---

## 📄 License

[Add your license here]

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 📞 Support

For issues or questions, please open an issue on GitHub.  
