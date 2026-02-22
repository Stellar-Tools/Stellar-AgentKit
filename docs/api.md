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
| `rpcUrl` | `string` | ❌ | Custom RPC URL endpoint |

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

`Promise<any>` - Transaction result from the Stellar network

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
  asset: string;
  amount: string;
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

`Promise<any>` - Transaction result

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
