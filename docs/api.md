# Stellar AgentKit API Reference

Complete reference for the `AgentClient` public API.

---

## Table of Contents

- [AgentClient Constructor](#agentclient-constructor)
- [Payment Methods](#payment-methods)
  - [send()](#send)
  - [getBalance()](#getbalance)
- [Token Issuance Methods](#token-issuance-methods)
  - [launchToken()](#launchtoken)
- [Swap Methods](#swap-methods)
  - [swap()](#swap)
- [Bridge Methods](#bridge-methods)
  - [bridge()](#bridge)
- [Liquidity Pool Methods](#liquidity-pool-methods)
  - [lp.deposit()](#lpdeposit)
  - [lp.withdraw()](#lpwithdraw)
  - [lp.getReserves()](#lpgetreserves)
  - [lp.getShareId()](#lpgetshareid)
- [Staking Methods](#staking-methods)
  - [staking.initialize()](#stakinginitialize)
  - [staking.stake()](#stakingstake)
  - [staking.unstake()](#stakingunstake)
  - [staking.claimRewards()](#stakingclaimrewards)
  - [staking.getStake()](#stakinggetstake)

---

## AgentClient Constructor

Creates a new instance of the Stellar AgentKit client.

### Signature

```typescript
constructor(config: AgentConfig)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `AgentConfig` | Yes | Configuration object for the agent client |
| `config.network` | `"testnet" \| "mainnet"` | Yes | Network to use for operations |
| `config.publicKey` | `string` | No | Stellar public key (G... address). Defaults to `STELLAR_PUBLIC_KEY` env var |
| `config.rpcUrl` | `string` | No | Custom RPC URL (optional) |
| `config.allowMainnet` | `boolean` | No | Required to be `true` for mainnet operations. Defaults to `false` |

### Returns

`AgentClient` instance

### Example

```typescript
import { AgentClient } from "stellartools";

// Testnet (no allowMainnet needed)
const agent = new AgentClient({
  network: "testnet",
  publicKey: "GABC...XYZ"
});

// Mainnet (requires explicit opt-in)
const mainnetAgent = new AgentClient({
  network: "mainnet",
  publicKey: "GABC...XYZ",
  allowMainnet: true  // Required for mainnet
});
```

### Safety Features

- **Mainnet Protection**: Attempting to use mainnet without `allowMainnet: true` will throw an error
- **Warning on Mainnet**: When mainnet is enabled, a warning is logged to remind that real funds are being used

---

## Payment Methods

### send()

Send native XLM payment to a recipient.

#### Signature

```typescript
async send(params: {
  recipient: string;
  amount: string;
}): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recipient` | `string` | Yes | Stellar public key of the recipient (G... address) |
| `amount` | `string` | Yes | Amount of XLM to send (in XLM, not stroops) |

#### Returns

`Promise<string>` - Success message with transaction hash

#### Example

```typescript
const result = await agent.send({
  recipient: "GDEST...ABC",
  amount: "100"  // 100 XLM
});

console.log(result);
// "Transaction successful! Hash: abc123..."
```

#### Errors

Throws descriptive error if:
- Recipient address is invalid
- Amount is not a positive number
- Private key is missing or invalid
- Transaction fails

---

### getBalance()

Get account balances for a Stellar address.

#### Signature

```typescript
async getBalance(publicKey?: string): Promise<BalanceResult>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicKey` | `string` | No | Stellar public key to query. Defaults to agent's public key |

#### Returns

```typescript
interface BalanceResult {
  publicKey: string;
  balances: AssetBalance[];
  network: "testnet" | "mainnet";
}

interface AssetBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}
```

#### Example

```typescript
// Get own balance
const myBalance = await agent.getBalance();

console.log(myBalance);
// {
//   publicKey: "GABC...XYZ",
//   balances: [
//     { asset_type: "native", balance: "9872.4398711" },
//     { asset_type: "credit_alphanum4", asset_code: "USDC",
//       asset_issuer: "GBBD...", balance: "500.00", limit: "10000.00" }
//   ],
//   network: "testnet"
// }

// Get another account's balance
const otherBalance = await agent.getBalance("GOTHER...ABC");
```

#### Errors

Throws descriptive error if:
- Account does not exist (404)
- Network request fails
- Invalid public key format

---

## Token Issuance Methods

### launchToken()

Create a new custom Stellar asset (token). Performs the complete issuance workflow including trustline creation, minting, and optional issuer lock.

#### Signature

```typescript
async launchToken(params: LaunchTokenParams): Promise<LaunchTokenResult>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | Asset code (1-12 alphanumeric characters, e.g., "MYTOKEN") |
| `issuerSecret` | `string` | Yes | Secret key of the issuer account |
| `distributorSecret` | `string` | Yes | Secret key of the distributor account |
| `initialSupply` | `string` | Yes | Initial token supply (e.g., "1000000") |
| `decimals` | `number` | No | Decimal precision (0-7). Defaults to 7 |
| `lockIssuer` | `boolean` | No | If true, locks issuer to prevent future issuance. Defaults to false |

#### Returns

```typescript
interface LaunchTokenResult {
  success: boolean;
  assetCode: string;
  issuerPublicKey: string;
  distributorPublicKey: string;
  initialSupply: string;
  issuerLocked: boolean;
  trustlineHash?: string;  // Transaction hash for trustline creation
  mintHash?: string;       // Transaction hash for token minting
  lockHash?: string;       // Transaction hash for issuer lock (if locked)
  network: "testnet" | "mainnet";
}
```

#### Example

```typescript
// Create a fixed-supply token (issuer locked)
const result = await agent.launchToken({
  code: "MYTOKEN",
  issuerSecret: process.env.ISSUER_SECRET!,
  distributorSecret: process.env.DISTRIBUTOR_SECRET!,
  initialSupply: "1000000",
  decimals: 7,
  lockIssuer: true  // Creates fixed supply
});

console.log(result);
// {
//   success: true,
//   assetCode: "MYTOKEN",
//   issuerPublicKey: "GISSUER...ABC",
//   distributorPublicKey: "GDIST...XYZ",
//   initialSupply: "1000000",
//   issuerLocked: true,
//   trustlineHash: "abc123...",
//   mintHash: "def456...",
//   lockHash: "ghi789...",
//   network: "testnet"
// }

// Create a token with unlimited supply (issuer not locked)
const unlimitedToken = await agent.launchToken({
  code: "UNLIMITED",
  issuerSecret: process.env.ISSUER_SECRET!,
  distributorSecret: process.env.DISTRIBUTOR_SECRET!,
  initialSupply: "500000",
  lockIssuer: false  // Issuer can mint more later
});
```

#### Workflow

The `launchToken` method performs these steps automatically:

1. **Account Validation** - Verifies issuer and distributor accounts exist and are funded
2. **Trustline Creation** - Distributor establishes trust for the new asset
3. **Token Minting** - Issuer sends initial supply to distributor
4. **Optional Lock** - If `lockIssuer: true`, sets issuer master key weight to 0 (prevents future issuance)

#### Safety Features

⚠️ **Mainnet token issuance requires explicit opt-in:**
- Set `ALLOW_MAINNET_TOKEN_ISSUANCE=true` in your `.env` file
- A warning is displayed before mainnet asset creation
- Tokens created on mainnet are permanent and immutable

**Issuer Lock Implications:**
- Once locked, the issuer cannot mint more tokens (fixed supply)
- This action is **irreversible**
- Common for tokens that should have a hard cap (like Bitcoin)

#### Errors

Enhanced error messages include:
- Asset code validation (length, characters)
- Account existence and funding status
- Transaction hashes for completed steps
- Network information
- Helpful hints (e.g., "Use Friendbot for testnet funding")

Example error:
```
Failed to load distributor account.
Context:
  - Distributor public key: GDIST...XYZ
  - Network: testnet
  - Error: Request failed with status code 404
  - Hint: Account may not be funded. Use Friendbot (testnet) or fund the account.
```

---

## Swap Methods

### swap()

Perform a token swap on the Stellar network.

#### Signature

```typescript
async swap(params: {
  to: string;
  buyA: boolean;
  out: string;
  inMax: string;
}): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Recipient address for the swapped tokens |
| `buyA` | `boolean` | Yes | `true` to buy asset A, `false` to buy asset B |
| `out` | `string` | Yes | Exact amount of output tokens desired |
| `inMax` | `string` | Yes | Maximum amount of input tokens willing to spend |

#### Returns

`Promise<void>` - Resolves when swap completes successfully

#### Example

```typescript
// Swap to get exactly 1000 of asset A, willing to spend up to 1200 of asset B
await agent.swap({
  to: "GDEST...ABC",
  buyA: true,
  out: "1000",
  inMax: "1200"
});
```

#### Errors

Enhanced error messages include:
- Caller and recipient addresses
- Swap direction (buying asset A or B)
- Requested output amount
- Maximum input amount
- Network (testnet/mainnet)
- Contract address

Example error:
```
Swap operation failed: Transaction failed with status: FAILED
Context:
  - Caller: GABC...XYZ
  - Recipient: GDEST...ABC
  - Direction: buying asset A
  - Output amount requested: 1000
  - Maximum input: 1200
  - Network: testnet
  - Contract: CCUMBJ...
```

---

## Bridge Methods

### bridge()

Bridge tokens from Stellar to EVM-compatible chains (currently supports USDC to Ethereum).

#### Signature

```typescript
async bridge(params: {
  amount: string;
  toAddress: string;
}): Promise<BridgeResult>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `string` | Yes | Amount of USDC to bridge |
| `toAddress` | `string` | Yes | Ethereum address (0x...) to receive tokens |

#### Returns

```typescript
interface BridgeResult {
  status: "confirmed" | "pending" | "pending_restore" | "trustline_submitted";
  hash: string;
  network: "stellar-testnet" | "stellar-mainnet";
  asset?: string;
  amount?: string;
}
```

#### Example

```typescript
const result = await agent.bridge({
  amount: "100",  // 100 USDC
  toAddress: "0x1234...5678"
});

console.log(result);
// {
//   status: "confirmed",
//   hash: "abc123...",
//   network: "stellar-testnet",
//   asset: "USDC",
//   amount: "100"
// }
```

#### Safety Features

⚠️ **Mainnet bridging requires TWO safeguards:**
1. `AgentClient` must be initialized with `allowMainnet: true`
2. Environment variable `ALLOW_MAINNET_BRIDGE=true` must be set

This dual-safeguard prevents accidental mainnet bridging.

#### Errors

Enhanced error messages include:
- Transaction hash
- Amount and token symbol
- Source and destination addresses
- Networks involved

---

## Liquidity Pool Methods

### lp.deposit()

Deposit tokens into a liquidity pool.

#### Signature

```typescript
async lp.deposit(params: {
  to: string;
  desiredA: string;
  minA: string;
  desiredB: string;
  minB: string;
}): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Address to receive LP share tokens |
| `desiredA` | `string` | Yes | Desired amount of asset A to deposit |
| `minA` | `string` | Yes | Minimum amount of asset A to deposit |
| `desiredB` | `string` | Yes | Desired amount of asset B to deposit |
| `minB` | `string` | Yes | Minimum amount of asset B to deposit |

#### Returns

`Promise<void>` - Resolves when deposit completes successfully

#### Example

```typescript
await agent.lp.deposit({
  to: "GDEST...ABC",
  desiredA: "1000",
  minA: "950",
  desiredB: "2000",
  minB: "1900"
});
```

#### Errors

Enhanced error messages include:
- Caller and recipient addresses
- Desired and minimum amounts for both assets
- Network (testnet/mainnet)
- Contract address

---

### lp.withdraw()

Withdraw tokens from a liquidity pool by burning LP shares.

#### Signature

```typescript
async lp.withdraw(params: {
  to: string;
  shareAmount: string;
  minA: string;
  minB: string;
}): Promise<readonly [BigInt, BigInt] | null>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Address to receive withdrawn tokens |
| `shareAmount` | `string` | Yes | Amount of LP share tokens to burn |
| `minA` | `string` | Yes | Minimum amount of asset A to receive |
| `minB` | `string` | Yes | Minimum amount of asset B to receive |

#### Returns

`Promise<readonly [BigInt, BigInt] | null>` - Array of `[amountA, amountB]` withdrawn, or `null`

#### Example

```typescript
const amounts = await agent.lp.withdraw({
  to: "GDEST...ABC",
  shareAmount: "500",
  minA: "450",
  minB: "900"
});

console.log(amounts);
// [475n, 950n] - received 475 of asset A and 950 of asset B
```

#### Errors

Enhanced error messages include:
- Caller and recipient addresses
- Share amount and minimum amounts
- Network (testnet/mainnet)
- Contract address

---

### lp.getReserves()

Get the current reserves of both assets in the liquidity pool.

#### Signature

```typescript
async lp.getReserves(): Promise<readonly [BigInt, BigInt] | null>
```

#### Parameters

None

#### Returns

`Promise<readonly [BigInt, BigInt] | null>` - Array of `[reserveA, reserveB]`, or `null`

#### Example

```typescript
const reserves = await agent.lp.getReserves();

console.log(reserves);
// [1000000n, 2000000n] - pool has 1M of asset A and 2M of asset B
```

---

### lp.getShareId()

Get the asset ID of the liquidity pool share token.

#### Signature

```typescript
async lp.getShareId(): Promise<string | null>
```

#### Parameters

None

#### Returns

`Promise<string | null>` - Share token contract address, or `null`

#### Example

```typescript
const shareId = await agent.lp.getShareId();

console.log(shareId);
// "CSHARE...XYZ"
```

---

## Staking Methods

### staking.initialize()

Initialize the staking contract with a token and reward rate.

#### Signature

```typescript
async staking.initialize(params: {
  tokenAddress: string;
  rewardRate: string;
}): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | `string` | Yes | Contract address of the token to stake |
| `rewardRate` | `string` | Yes | Reward rate per unit time (as a string to prevent precision loss) |

#### Returns

`Promise<string>` - Success message

#### Example

```typescript
const result = await agent.staking.initialize({
  tokenAddress: "CTOKEN...ABC",
  rewardRate: "1000000"  // String to preserve precision
});

console.log(result);
// "Contract initialized successfully"
```

#### Errors

Enhanced error messages include:
- Caller address
- Token address
- Reward rate
- Network (testnet/mainnet)
- Contract address

---

### staking.stake()

Stake tokens in the staking contract.

#### Signature

```typescript
async staking.stake(params: {
  amount: string;
}): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `string` | Yes | Amount of tokens to stake (as string to prevent precision loss) |

#### Returns

`Promise<string>` - Success message with amount staked

#### Example

```typescript
const result = await agent.staking.stake({
  amount: "500000000"  // 50 XLM if using 7 decimals
});

console.log(result);
// "Staked 500000000 successfully"
```

#### Errors

Enhanced error messages include:
- Caller address
- Amount
- Network (testnet/mainnet)
- Contract address

---

### staking.unstake()

Unstake tokens from the staking contract.

#### Signature

```typescript
async staking.unstake(params: {
  amount: string;
}): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `string` | Yes | Amount of tokens to unstake (as string to prevent precision loss) |

#### Returns

`Promise<string>` - Success message with amount unstaked

#### Example

```typescript
const result = await agent.staking.unstake({
  amount: "200000000"
});

console.log(result);
// "Unstaked 200000000 successfully"
```

#### Errors

Enhanced error messages include:
- Caller address
- Amount
- Network (testnet/mainnet)
- Contract address

---

### staking.claimRewards()

Claim accumulated staking rewards.

#### Signature

```typescript
async staking.claimRewards(): Promise<string>
```

#### Parameters

None

#### Returns

`Promise<string>` - Success message

#### Example

```typescript
const result = await agent.staking.claimRewards();

console.log(result);
// "Rewards claimed successfully"
```

---

### staking.getStake()

Get the staked amount for a specific address.

#### Signature

```typescript
async staking.getStake(userAddress: string): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userAddress` | `string` | Yes | Stellar address to query stake for |

#### Returns

`Promise<string>` - Message with staked amount

#### Example

```typescript
const result = await agent.staking.getStake("GUSER...ABC");

console.log(result);
// "Stake for GUSER...ABC: 500000000"
```

---

## Complete Usage Example

```typescript
import { AgentClient } from "stellartools";

async function main() {
  // 1. Initialize client
  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY
  });

  // 2. Check balance before operations
  const balance = await agent.getBalance();
  console.log("Current balance:", balance);

  // 3. Launch a new token
  const tokenResult = await agent.launchToken({
    code: "MYTOKEN",
    issuerSecret: process.env.ISSUER_SECRET!,
    distributorSecret: process.env.DISTRIBUTOR_SECRET!,
    initialSupply: "1000000",
    decimals: 7,
    lockIssuer: true  // Fixed supply
  });
  console.log("Token launched:", tokenResult);

  // 4. Send payment
  await agent.send({
    recipient: "GDEST...ABC",
    amount: "10"
  });

  // 5. Perform swap
  await agent.swap({
    to: "GDEST...ABC",
    buyA: true,
    out: "1000",
    inMax: "1200"
  });

  // 6. Add liquidity
  await agent.lp.deposit({
    to: "GDEST...ABC",
    desiredA: "1000",
    minA: "950",
    desiredB: "2000",
    minB: "1900"
  });

  // 7. Stake tokens
  await agent.staking.stake({
    amount: "500000000"
  });

  // 8. Check reserves
  const reserves = await agent.lp.getReserves();
  console.log("Pool reserves:", reserves);

  // 9. Bridge to Ethereum
  const bridgeResult = await agent.bridge({
    amount: "100",
    toAddress: "0x1234...5678"
  });
  console.log("Bridge result:", bridgeResult);
}

main().catch(console.error);
```

---

## Error Handling

All methods throw enhanced errors with detailed context when operations fail. Always wrap calls in try-catch blocks:

```typescript
try {
  await agent.swap({
    to: "GDEST...ABC",
    buyA: true,
    out: "1000",
    inMax: "1200"
  });
} catch (error) {
  console.error("Swap failed:", error.message);
  // Error message includes full context:
  // - Caller/recipient addresses
  // - Swap parameters
  // - Network
  // - Contract address
}
```

---

## Type Definitions

```typescript
interface AgentConfig {
  network: "testnet" | "mainnet";
  rpcUrl?: string;
  publicKey?: string;
  allowMainnet?: boolean;
}

interface BalanceResult {
  publicKey: string;
  balances: AssetBalance[];
  network: string;
}

interface AssetBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

interface BridgeResult {
  status: "confirmed" | "pending" | "pending_restore" | "trustline_submitted";
  hash: string;
  network: "stellar-testnet" | "stellar-mainnet";
  asset?: string;
  amount?: string;
}

interface LaunchTokenParams {
  code: string;
  issuerSecret: string;
  distributorSecret: string;
  initialSupply: string;
  decimals?: number;
  lockIssuer?: boolean;
}

interface LaunchTokenResult {
  success: boolean;
  assetCode: string;
  issuerPublicKey: string;
  distributorPublicKey: string;
  initialSupply: string;
  issuerLocked: boolean;
  trustlineHash?: string;
  mintHash?: string;
  lockHash?: string;
  network: "testnet" | "mainnet";
}
```

---

## Best Practices

1. **Use strings for amounts**: Always pass token amounts as strings to prevent JavaScript floating-point precision loss
2. **Check balances first**: Use `getBalance()` before operations to ensure sufficient funds
3. **Handle errors**: All operations can fail - always use try-catch blocks
4. **Mainnet safety**: Never enable mainnet without understanding the implications - real funds will be used
5. **Environment variables**: Store sensitive keys in `.env` files, never commit them to version control

---

## Additional Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Stellar Testnet](https://laboratory.stellar.org/)
