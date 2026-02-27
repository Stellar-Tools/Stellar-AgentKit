# Stellar AgentKit API Reference

The `AgentClient` provides a unified interface for interacting with the Stellar blockchain, supporting swaps, cross-chain bridging, and liquidity pool operations.

## AgentClient

### Constructor

```typescript
new AgentClient(config: AgentConfig)
```

**Parameters:**

- `config.network`: `"testnet" | "mainnet"` - The Stellar network to connect to.
- `config.publicKey`: `string` (optional) - The public key of the account performing operations. Defaults to `STELLAR_PUBLIC_KEY` environment variable.
- `config.rpcUrl`: `string` (optional) - Custom RPC URL for Soroban interactions.
- `config.allowMainnet`: `boolean` (optional) - Required to enable any mainnet operations.
- `config.allowMainnetTokenIssuance`: `boolean` (optional) - Additional safeguard specifically for mainnet token launch.

**Example:**

```typescript
import { AgentClient } from "stellartools";

const agent = new AgentClient({
  network: "testnet",
});
```

---

### Methods

#### `swap(params)`

Performs a token swap using the liquidity contract.

**Parameters:**

- `params.to`: `string` - Destination address for the swapped tokens.
- `params.buyA`: `boolean` - `true` to buy asset A, `false` to buy asset B.
- `params.out`: `string` - Amount of output tokens.
- `params.inMax`: `string` - Maximum amount of input tokens allowed.

**Returns:** `Promise<any>`

**Example:**

```typescript
await agent.swap({
  to: "GB...",
  buyA: true,
  out: "100",
  inMax: "110",
});
```

#### `bridge(params)`

Bridges tokens from Stellar to EVM-compatible chains using Allbridge.

**Parameters:**

- `params.amount`: `string` - Amount of tokens to bridge.
- `params.toAddress`: `string` - Destination address on the target chain (e.g., ETH address).

**Returns:** `Promise<any>`

**Example:**

```typescript
await agent.bridge({
  amount: "50",
  toAddress: "0x123...",
});
```

#### `launchToken(params)`

Creates a new Stellar classic asset (issuer, trustline, and initial mint).

**Parameters:**

- `params.symbol`: `string` - 1-12 alphanumeric characters for the asset code.
- `params.initialSupply`: `string` - Initial amount to mint.
- `params.decimals`: `number` (optional) - Asset decimals (0-7, default 7).
- `params.issuerSecretKey`: `string` - Private key of the issuing account.
- `params.distributorPublicKey`: `string` - Public key of the account to receive initial supply.
- `params.distributorSecretKey`: `string` (optional) - Required if the trustline needs to be created automatically.

**Returns:** `Promise<any>`

**Guardrails:**
Mainnet issuance requires `allowMainnetTokenIssuance: true` and `ALLOW_MAINNET_TOKEN_ISSUANCE=true` in `.env`.

---

### Liquidity Pool (LP) Operations

Accessed via `agent.lp`.

#### `agent.lp.deposit(params)`

Deposits assets into the liquidity pool.

**Parameters:**

- `params.to`: `string` - Address to receive the LP shares.
- `params.desiredA`: `string` - Desired amount of asset A.
- `params.minA`: `string` - Minimum amount of asset A.
- `params.desiredB`: `string` - Desired amount of asset B.
- `params.minB`: `string` - Minimum amount of asset B.

#### `agent.lp.withdraw(params)`

Withdraws assets from the liquidity pool.

**Parameters:**

- `params.to`: `string` - Address to receive the withdrawn assets.
- `params.shareAmount`: `string` - Amount of LP shares to burn.
- `params.minA`: `string` - Minimum amount of asset A to receive.
- `params.minB`: `string` - Minimum amount of asset B to receive.

#### `agent.lp.getReserves()`

Returns the current reserves of the liquidity pool.

**Returns:** `Promise<[bigint, bigint]>`

#### `agent.lp.getShareId()`

Returns the share ID of the liquidity pool.

**Returns:** `Promise<string>`

---

## Error contract

The following table summarizes when methods throw and what to expect.

| Method / context                          | When it throws                                     | Typical message or condition                 |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `new AgentClient({ network: "mainnet" })` | Mainnet without `allowMainnet: true`               | `"🚫 Mainnet execution blocked for safety."` |
| `launchToken(params)`                     | Mainnet without dual-safeguards                    | `"Token issuance on mainnet is disabled."`   |
| `launchToken(params)`                     | Invalid decimals or symbol                         | `invalid_decimals`, `invalid_address`        |
| `swap(params)`                            | Invalid address format                             | `invalid_address`                            |
| `bridge(params)`                          | Mainnet bridge without `ALLOW_MAINNET_BRIDGE=true` | `"Mainnet bridging is disabled."`            |
| All tools                                 | Missing `STELLAR_PUBLIC_KEY` during execution      | `"Missing STELLAR_PUBLIC_KEY"`               |
