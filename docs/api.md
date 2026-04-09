# 📘 AgentClient API Reference

## Constructor

### `new AgentClient(config)`

Creates a new AgentClient instance for interacting with the Stellar network.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `network` | `"testnet" \| "mainnet"` | ✅ | Network to connect to |
| `allowMainnet` | `boolean` | ❌ | Required for mainnet execution (safety flag) |
| `publicKey` | `string` | ❌ | Public key for operations (can use env var) |

#### Example

```typescript
// Testnet usage (recommended for development)
const agent = new AgentClient({
  network: "testnet",
  publicKey: "GXXXX..."
});

// Mainnet usage (requires explicit opt-in)
const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true,
  publicKey: "GXXXX..."
});
```

---

## 🔄 swap()

Performs token swap on Stellar network using the configured liquidity pool.

> **Note:** Swap and liquidity pool operations currently execute on the Stellar **testnet only**, using a testnet RPC URL and passphrase, regardless of the `AgentClient`’s `network` or `rpcUrl` settings. Do not treat these methods as mainnet‑ready.
#### Parameters

```typescript
{
  to: string;      // Recipient address
  buyA: boolean;   // Swap direction (true = buy asset A, false = buy asset B)
  out: string;     // Expected output amount
  inMax: string;   // Maximum input amount willing to pay
}
```

#### Returns

`Promise<void>` - Resolves when the swap transaction has been submitted to the Stellar network

#### Example

```typescript
await agent.swap({
  to: "GXXXX...",
  buyA: true,
  out: "100",
  inMax: "110"
});
```

---

## 🧭 dex.quoteSwap()

Quotes Stellar Classic swap routes using Horizon path discovery. This can return
routes that traverse the SDEX and/or Stellar built-in liquidity pools.

The public `limit` controls how many ranked quotes are returned to the caller.
The SDK may fetch a larger fixed candidate window from Horizon internally before
ranking and slicing the final response.

#### Parameters

```typescript
{
  mode: "strict-send" | "strict-receive";
  sendAsset: { type: "native" } | { code: string; issuer: string };
  destAsset: { type: "native" } | { code: string; issuer: string };
  sendAmount?: string;   // Required for strict-send
  destAmount?: string;   // Required for strict-receive
  destination?: string;  // Defaults to the configured public key
  limit?: number;        // Defaults to 5
}
```

#### Returns

```typescript
Promise<Array<{
  path: Array<{ type: "native" } | { code: string; issuer: string }>;
  sendAmount: string;
  destAmount: string;
  estimatedPrice: string;
  hopCount: number;
  raw: object;
}>>
```

#### Example

```typescript
const quotes = await agent.dex.quoteSwap({
  mode: "strict-send",
  sendAsset: { code: "USDC", issuer: "G..." },
  destAsset: { code: "EURC", issuer: "G..." },
  sendAmount: "25.0000000"
});
```

---

## 🧭 dex.swapBestRoute()

Executes the top-ranked route returned by Stellar Classic pathfinding.

> **Signer requirement:** `STELLAR_PRIVATE_KEY` must correspond to the same
> account as the configured `publicKey`, or execution fails before submission.

#### Parameters

```typescript
{
  mode: "strict-send" | "strict-receive";
  sendAsset: { type: "native" } | { code: string; issuer: string };
  destAsset: { type: "native" } | { code: string; issuer: string };
  sendAmount?: string;   // Required for strict-send
  destAmount?: string;   // Required for strict-receive
  destination?: string;  // Defaults to the configured public key
  slippageBps?: number;  // Defaults to 100
}
```

#### Returns

```typescript
Promise<{
  hash: string;
  mode: "strict-send" | "strict-receive";
  sendAmount: string;
  destAmount: string;
  path: Array<{ type: "native" } | { code: string; issuer: string }>;
}>
```

#### Example

```typescript
const result = await agent.dex.swapBestRoute({
  mode: "strict-receive",
  sendAsset: { code: "USDC", issuer: "G..." },
  destAsset: { code: "EURC", issuer: "G..." },
  destAmount: "20.0000000",
  slippageBps: 100
});
```

---

## 🌉 bridge()

Performs cross-chain bridge operation from Stellar to EVM compatible chains.

⚠️ **IMPORTANT**: Mainnet bridging requires BOTH:
1. AgentClient initialized with `allowMainnet: true`
2. `ALLOW_MAINNET_BRIDGE=true` in your .env file

#### Parameters

```typescript
{
  amount: string;     // Amount to bridge
  toAddress: string;  // EVM destination address
}
```

#### Returns

```typescript
Promise<{
  status: string;
  hash: string;
  network: string;
  asset?: string;  // Present for completed/settled bridge operations
  amount?: string; // Present for completed/settled bridge operations
}>
```

#### Example

```typescript
await agent.bridge({
  amount: "100",
  toAddress: "0x742d35Cc6Db050e3797bf604dC8a98c13a0e002E"
});
```

---

## 💧 Liquidity Pool Methods

These are the existing Soroban single-pool LP helpers. They are separate from
the new Classic DEX route optimizer under `agent.dex.*`.

### `lp.deposit()`

Adds liquidity to the pool by providing both assets.

#### Parameters

```typescript
{
  to: string;        // Recipient address
  desiredA: string;  // Desired amount of asset A
  minA: string;      // Minimum amount of asset A
  desiredB: string;  // Desired amount of asset B
  minB: string;      // Minimum amount of asset B
}
```

#### Returns

`Promise<void>` - Resolves when the deposit transaction has been submitted

#### Example

```typescript
await agent.lp.deposit({
  to: "GXXXX...",
  desiredA: "1000",
  minA: "950",
  desiredB: "1000",
  minB: "950"
});
```

### `lp.withdraw()`

Removes liquidity from the pool by burning share tokens.

#### Parameters

```typescript
{
  to: string;          // Recipient address
  shareAmount: string; // Amount of share tokens to burn
  minA: string;        // Minimum amount of asset A to receive
  minB: string;        // Minimum amount of asset B to receive
}
```

#### Returns

`Promise<readonly [BigInt, BigInt] | null>` - Array of withdrawn amounts [assetA, assetB]

#### Example

```typescript
const result = await agent.lp.withdraw({
  to: "GXXXX...",
  shareAmount: "100",
  minA: "95",
  minB: "95"
});
```

### `lp.getReserves()`

Returns current pool reserves for both assets.

#### Parameters

None

#### Returns

`Promise<readonly [BigInt, BigInt] | null>` - Array of reserve amounts [reserveA, reserveB]

#### Example

```typescript
const reserves = await agent.lp.getReserves();
console.log(`Reserve A: ${reserves[0]}, Reserve B: ${reserves[1]}`);
```

### `lp.getShareId()`

Returns the pool share token ID.

#### Parameters

None

#### Returns

`Promise<string | null>` - Share token contract ID

#### Example

```typescript
const shareId = await agent.lp.getShareId();
console.log(`Share Token ID: ${shareId}`);
```

---

## 🚨 Error Handling

All methods may throw errors in the following scenarios:

- **Network errors**: Connection issues with Stellar RPC
- **Transaction failures**: Insufficient balance, slippage exceeded
- **Invalid parameters**: Malformed addresses, negative amounts
- **Mainnet safety**: Attempting mainnet operations without proper flags

#### Example Error Handling

```typescript
try {
  await agent.swap({
    to: "GXXXX...",
    buyA: true,
    out: "100",
    inMax: "110"
  });
} catch (error) {
  console.error("Swap failed:", error.message);
}
```

---

## 📋 Type Definitions

```typescript
interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean;
}
```

---

## 🔗 Related Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Smart Contract Docs](https://soroban.stellar.org/docs)
- [Stellar Network Overview](https://developers.stellar.org/docs/fundamentals/stellar-data-structures/accounts)
