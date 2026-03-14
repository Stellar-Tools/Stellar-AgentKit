# Transaction Tracking Guide

## Overview

The Transaction Tracking System provides comprehensive monitoring and status tracking for all Stellar operations in the AgentKit. It enables developers to track transaction status, monitor multiple transactions simultaneously, and implement robust retry logic.

## Features

- ✅ **Real-time Transaction Monitoring** - Track transaction status in real-time
- ✅ **Automatic Retry Logic** - Configurable retry mechanism with timeout support
- ✅ **Multi-Transaction Support** - Monitor multiple transactions simultaneously
- ✅ **Operation Type Filtering** - Filter and query transactions by operation type
- ✅ **Network Switching** - Support for both testnet and mainnet
- ✅ **Detailed Status Information** - Get comprehensive transaction details including ledger, timestamps, and return values
- ✅ **Error Handling** - Robust error handling with descriptive error messages

## Installation

The Transaction Tracker is included in the core Stellar AgentKit package:

```bash
npm install stellartools
```

## Quick Start

### Basic Usage with AgentClient

```typescript
import { AgentClient, OperationType, TransactionStatus } from "stellartools";

// Initialize AgentClient with tracking enabled (default)
const agent = new AgentClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
  enableTracking: true, // Optional, enabled by default
});

// Perform an operation
const result = await agent.swap({
  to: "GXXXXXXX...",
  buyA: true,
  out: "100",
  inMax: "110",
});

// Wait for confirmation
if (result.hash) {
  const status = await agent.waitForConfirmation(
    result.hash,
    OperationType.SWAP
  );
  
  if (status.status === TransactionStatus.SUCCESS) {
    console.log("✅ Transaction confirmed!");
  }
}
```

### Standalone Transaction Tracker

```typescript
import { createTransactionTracker, OperationType } from "stellartools";

// Create a standalone tracker
const tracker = createTransactionTracker({
  network: "testnet",
  maxRetries: 30,
  retryInterval: 2000, // 2 seconds
  timeout: 60000, // 60 seconds
});

// Track a transaction
tracker.trackTransaction("tx_hash_123", OperationType.BRIDGE, {
  amount: "100",
  toAddress: "0x742d35Cc...",
});

// Get transaction status
const status = await tracker.getTransactionStatus("tx_hash_123");
console.log("Status:", status.status);
```

## Configuration

### TransactionTrackerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `network` | `"testnet" \| "mainnet"` | `"testnet"` | Network to connect to |
| `rpcUrl` | `string` | Auto-detected | Custom RPC URL |
| `maxRetries` | `number` | `30` | Maximum retry attempts |
| `retryInterval` | `number` | `2000` | Interval between retries (ms) |
| `timeout` | `number` | `60000` | Total timeout duration (ms) |

### Example Configuration

```typescript
const tracker = new TransactionTracker({
  network: "mainnet",
  rpcUrl: "https://soroban.stellar.org",
  maxRetries: 50,
  retryInterval: 1500,
  timeout: 120000, // 2 minutes
});
```

## API Reference

### TransactionTracker Class

#### Constructor

```typescript
new TransactionTracker(config?: TransactionTrackerConfig)
```

#### Methods

##### `trackTransaction(hash, operationType, params?)`

Track a new transaction.

```typescript
tracker.trackTransaction(
  "tx_hash_123",
  OperationType.SWAP,
  { amount: "100", buyA: true }
);
```

**Parameters:**
- `hash` (string): Transaction hash
- `operationType` (OperationType): Type of operation
- `params` (object, optional): Additional parameters

##### `getTransactionStatus(hash)`

Get the current status of a transaction.

```typescript
const status = await tracker.getTransactionStatus("tx_hash_123");
```

**Returns:** `Promise<TransactionStatusResponse>`

##### `waitForConfirmation(hash, operationType)`

Wait for transaction confirmation with retry logic.

```typescript
const status = await tracker.waitForConfirmation(
  "tx_hash_123",
  OperationType.SWAP
);
```

**Returns:** `Promise<TransactionStatusResponse>`

##### `monitorTransactions(hashes, operationType)`

Monitor multiple transactions simultaneously.

```typescript
const statuses = await tracker.monitorTransactions(
  ["hash1", "hash2", "hash3"],
  OperationType.BRIDGE
);
```

**Returns:** `Promise<TransactionStatusResponse[]>`

##### `getTrackedTransactions()`

Get all tracked transactions.

```typescript
const tracked = tracker.getTrackedTransactions();
// Returns: Map<string, TransactionMetadata>
```

##### `getTransactionsByType(operationType)`

Filter transactions by operation type.

```typescript
const swapTxs = tracker.getTransactionsByType(OperationType.SWAP);
```

**Returns:** `Array<{ hash: string, metadata: TransactionMetadata }>`

##### `clearTracking()`

Clear all tracked transactions.

```typescript
tracker.clearTracking();
```

##### `updateNetwork(network, rpcUrl?)`

Update network configuration.

```typescript
tracker.updateNetwork("mainnet", "https://soroban.stellar.org");
```

##### `getNetworkInfo()`

Get current network information.

```typescript
const info = tracker.getNetworkInfo();
// Returns: { network: NetworkType, rpcUrl: string }
```

## Transaction Status Types

### TransactionStatus Enum

```typescript
enum TransactionStatus {
  PENDING = "PENDING",       // Transaction submitted but not confirmed
  SUCCESS = "SUCCESS",       // Transaction confirmed successfully
  FAILED = "FAILED",         // Transaction failed
  NOT_FOUND = "NOT_FOUND",   // Transaction not found on network
  TIMEOUT = "TIMEOUT",       // Confirmation timeout reached
}
```

### TransactionStatusResponse Interface

```typescript
interface TransactionStatusResponse {
  hash: string;                    // Transaction hash
  status: TransactionStatus;       // Current status
  network: NetworkType;            // Network (testnet/mainnet)
  operationType: OperationType;    // Operation type
  ledger?: number;                 // Ledger number (if confirmed)
  createdAt?: string;              // Creation timestamp
  applicationOrder?: number;       // Application order in ledger
  envelopeXdr?: string;           // Transaction envelope XDR
  resultXdr?: string;             // Transaction result XDR
  resultMetaXdr?: string;         // Transaction result metadata XDR
  returnValue?: any;              // Parsed return value
  errorMessage?: string;          // Error message (if failed)
  retryCount?: number;            // Number of retries attempted
  elapsedTime?: number;           // Elapsed time (ms)
}
```

## Operation Types

```typescript
enum OperationType {
  SWAP = "swap",
  BRIDGE = "bridge",
  LP_DEPOSIT = "lp_deposit",
  LP_WITHDRAW = "lp_withdraw",
  PAYMENT = "payment",
  STAKE = "stake",
}
```

## Usage Examples

### Example 1: Track a Swap Transaction

```typescript
const agent = new AgentClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});

const swapResult = await agent.swap({
  to: "GXXXXXXX...",
  buyA: true,
  out: "100",
  inMax: "110",
});

// Wait for confirmation
const status = await agent.waitForConfirmation(
  swapResult.hash,
  OperationType.SWAP
);

console.log("Status:", status.status);
console.log("Ledger:", status.ledger);
```

### Example 2: Monitor Multiple Bridge Transactions

```typescript
const tracker = createTransactionTracker({ network: "testnet" });

// Track multiple bridge operations
const hashes = ["hash1", "hash2", "hash3"];
hashes.forEach(hash => {
  tracker.trackTransaction(hash, OperationType.BRIDGE);
});

// Monitor all simultaneously
const statuses = await tracker.monitorTransactions(
  hashes,
  OperationType.BRIDGE
);

// Check results
statuses.forEach((status, i) => {
  console.log(`Transaction ${i + 1}: ${status.status}`);
});
```

### Example 3: Handle Different Status Types

```typescript
const status = await tracker.waitForConfirmation(hash, OperationType.SWAP);

switch (status.status) {
  case TransactionStatus.SUCCESS:
    console.log("✅ Success! Ledger:", status.ledger);
    break;
    
  case TransactionStatus.FAILED:
    console.error("❌ Failed:", status.errorMessage);
    break;
    
  case TransactionStatus.TIMEOUT:
    console.warn("⏱️ Timeout after", status.elapsedTime, "ms");
    break;
    
  case TransactionStatus.NOT_FOUND:
    console.warn("🔍 Transaction not found");
    break;
    
  case TransactionStatus.PENDING:
    console.log("⏳ Still pending...");
    break;
}
```

### Example 4: Filter Transactions by Type

```typescript
const tracker = createTransactionTracker();

// Track various operations
tracker.trackTransaction("swap1", OperationType.SWAP);
tracker.trackTransaction("swap2", OperationType.SWAP);
tracker.trackTransaction("bridge1", OperationType.BRIDGE);
tracker.trackTransaction("lp1", OperationType.LP_DEPOSIT);

// Get only swap transactions
const swapTxs = tracker.getTransactionsByType(OperationType.SWAP);
console.log(`Found ${swapTxs.length} swap transactions`);

// Get all tracked transactions
const allTxs = tracker.getTrackedTransactions();
console.log(`Total: ${allTxs.size} transactions`);
```

### Example 5: Network Switching

```typescript
const tracker = new TransactionTracker({ network: "testnet" });

// Track testnet transactions
tracker.trackTransaction("testnet_tx", OperationType.SWAP);

// Switch to mainnet
tracker.updateNetwork("mainnet");

// Track mainnet transactions
tracker.trackTransaction("mainnet_tx", OperationType.BRIDGE);

// Tracked transactions persist across network changes
console.log("Total tracked:", tracker.getTrackedTransactions().size);
```

### Example 6: Custom Retry Configuration

```typescript
const tracker = new TransactionTracker({
  network: "testnet",
  maxRetries: 50,        // Try up to 50 times
  retryInterval: 1000,   // Wait 1 second between retries
  timeout: 120000,       // Total timeout: 2 minutes
});

const status = await tracker.waitForConfirmation(
  "tx_hash",
  OperationType.BRIDGE
);

console.log("Retry count:", status.retryCount);
console.log("Elapsed time:", status.elapsedTime, "ms");
```

## Integration with AgentClient

The Transaction Tracker is automatically integrated with AgentClient:

```typescript
const agent = new AgentClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
  enableTracking: true, // Enabled by default
});

// Access the tracker directly
const tracker = agent.getTracker();

if (tracker) {
  // Use tracker methods
  const networkInfo = tracker.getNetworkInfo();
  const allTxs = tracker.getTrackedTransactions();
}

// Or use AgentClient methods
const status = await agent.getTransactionStatus("tx_hash");
const confirmed = await agent.waitForConfirmation(hash, OperationType.SWAP);
```

## Best Practices

### 1. Always Handle Timeouts

```typescript
const status = await tracker.waitForConfirmation(hash, OperationType.SWAP);

if (status.status === TransactionStatus.TIMEOUT) {
  // Implement fallback logic
  console.warn("Transaction timeout - check status manually later");
  // Optionally: retry with longer timeout
}
```

### 2. Use Appropriate Retry Configuration

```typescript
// For time-sensitive operations
const fastTracker = new TransactionTracker({
  maxRetries: 20,
  retryInterval: 1000,
  timeout: 30000,
});

// For patient operations
const patientTracker = new TransactionTracker({
  maxRetries: 60,
  retryInterval: 3000,
  timeout: 300000, // 5 minutes
});
```

### 3. Store Transaction Metadata

```typescript
tracker.trackTransaction("tx_hash", OperationType.BRIDGE, {
  amount: "100",
  toAddress: "0x742d35Cc...",
  timestamp: Date.now(),
  userId: "user_123",
});

// Retrieve later
const tracked = tracker.getTrackedTransactions();
const metadata = tracked.get("tx_hash");
console.log("User:", metadata.params.userId);
```

### 4. Clean Up Tracking History

```typescript
// Periodically clear old transactions
setInterval(() => {
  const tracked = tracker.getTrackedTransactions();
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  for (const [hash, metadata] of tracked) {
    if (metadata.timestamp < oneHourAgo) {
      // Remove old transactions
      tracked.delete(hash);
    }
  }
}, 3600000); // Every hour
```

### 5. Handle Network Errors Gracefully

```typescript
try {
  const status = await tracker.getTransactionStatus("tx_hash");
  
  if (status.status === TransactionStatus.FAILED && status.errorMessage) {
    console.error("Transaction failed:", status.errorMessage);
    // Implement error recovery logic
  }
} catch (error) {
  console.error("Network error:", error);
  // Retry or fallback
}
```

## Troubleshooting

### Transaction Not Found

If you get `TransactionStatus.NOT_FOUND`:

1. Verify the transaction hash is correct
2. Ensure you're connected to the correct network (testnet/mainnet)
3. Wait a few seconds and retry - the transaction may still be propagating
4. Check if the transaction was actually submitted

### Timeout Issues

If you frequently encounter timeouts:

1. Increase `maxRetries` and `timeout` values
2. Check network connectivity
3. Verify RPC URL is accessible
4. Consider using a different RPC endpoint

### Memory Management

For long-running applications:

```typescript
// Periodically clear tracking history
setInterval(() => {
  tracker.clearTracking();
}, 3600000); // Clear every hour
```

## Advanced Usage

### Custom Transaction Monitoring

```typescript
class CustomMonitor {
  private tracker: TransactionTracker;
  
  constructor() {
    this.tracker = createTransactionTracker();
  }
  
  async monitorWithCallback(
    hash: string,
    operationType: OperationType,
    onUpdate: (status: TransactionStatusResponse) => void
  ) {
    const status = await this.tracker.waitForConfirmation(hash, operationType);
    onUpdate(status);
    return status;
  }
}
```

### Batch Transaction Processing

```typescript
async function processBatch(hashes: string[]) {
  const tracker = createTransactionTracker();
  const batchSize = 10;
  
  for (let i = 0; i < hashes.length; i += batchSize) {
    const batch = hashes.slice(i, i + batchSize);
    const statuses = await tracker.monitorTransactions(
      batch,
      OperationType.SWAP
    );
    
    // Process batch results
    statuses.forEach(status => {
      console.log(`${status.hash}: ${status.status}`);
    });
  }
}
```

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/Stellar-Tools/Stellar-AgentKit/issues)
- Check the [examples](../examples/transaction-tracking-example.ts)
- Review the [test suite](../tests/transactionTracker.test.ts)

## License

MIT License - See LICENSE file for details
