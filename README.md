# Stellar AgentKit 🌟

Stellar AgentKit is an open-source SDK and platform for interacting with the Stellar blockchain,
providing a unified agent to perform complex DeFi operations such as swaps, bridges, and liquidity
pool (LP) actions.

Built for both developers and end users, AgentKit simplifies Stellar-based DeFi by consolidating
multiple operations into a single programmable and extensible toolkit.

---

## ✨ Features

- Token swaps on Stellar
- Cross-chain bridging
- Liquidity pool (LP) deposits & withdrawals
- Querying pool reserves and share IDs
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

### Testnet Swap

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

### Mainnet Swap

```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true, // Required
  publicKey: process.env.STELLAR_PUBLIC_KEY
});

await agent.swap({
  to: "recipient_address",
  buyA: true,
  out: "100",
  inMax: "110"
});
```

---

## 💰 Asset Management

Manage Stellar assets: retrieve account balances, create custom assets, and manage trustlines for different tokens.

### Get Account Balances

```typescript
import { assetManagementTool } from "stellartools";

const balances = await assetManagementTool.invoke({
  action: "get_balances",
  network: "stellar-testnet"
});
// Returns: [{ asset: "XLM", balance: "1000" }, { asset: "USDC", balance: "500", issuer: "..." }]
```

### Manage Trustlines

Add or remove trustlines to hold custom Stellar assets:

```typescript
// Add trustline for a custom asset
const result = await assetManagementTool.invoke({
  action: "manage_trustline",
  assetCode: "USDC",
  assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  operation: "add",
  limit: "1000000", // Optional, defaults to 1000000
  network: "stellar-testnet"
});

// Remove trustline
await assetManagementTool.invoke({
  action: "manage_trustline",
  assetCode: "USDC",
  assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  operation: "remove",
  network: "stellar-testnet"
});
```

### Create Custom Assets

Issue new custom assets on Stellar. The recipient must have a pre-existing trustline for the asset.

```typescript
const created = await assetManagementTool.invoke({
  action: "create_asset",
  assetCode: "MYTOKEN",              // 1-12 alphanumeric characters
  recipientAddress: "GBUQWP...",    // Must have trustline for asset
  amount: "1000",                    // Amount to issue
  network: "stellar-testnet"
});
// Returns: "Asset MYTOKEN issued successfully. Transaction hash: ..."
```

**Important:** The recipient must add a trustline for your asset **before** you can send it to them.

### Mainnet Asset Management

⚠️ **All mainnet operations require explicit safeguard:**

Create a `.env` file with:
```bash
STELLAR_PUBLIC_KEY=your_mainnet_public_key
STELLAR_PRIVATE_KEY=your_mainnet_private_key
ALLOW_MAINNET_ASSET_MANAGEMENT=true  # Required for all mainnet asset management operations
```

```typescript
await assetManagementTool.invoke({
  action: "create_asset",
  assetCode: "MYTOKEN",
  recipientAddress: "GBUQWP...",
  amount: "1000",
  network: "stellar-mainnet"  // Requires ALLOW_MAINNET_ASSET_MANAGEMENT=true
});
```

**Error Example (without safeguard):**
```
Mainnet asset management is disabled. Set ALLOW_MAINNET_ASSET_MANAGEMENT=true 
in your .env file to enable.
```

### Input Validation

Asset management enforces strict validation:

- **assetCode:** 1-12 alphanumeric characters
- **assetIssuer / recipientAddress:** Valid Stellar public keys (Ed25519)
- **amount / limit:** Positive numbers with up to 7 decimal places
- **Keypair consistency:** `STELLAR_PRIVATE_KEY` must derive to matching `STELLAR_PUBLIC_KEY`

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

## 💧 Liquidity Pool Operations

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

## 🌐 Supported Networks

- **Testnet** - Full support, no restrictions, safe for development
- **Mainnet** - Full support with dual-safeguard system:
  - **Swaps & LP operations:** Require `allowMainnet: true` in AgentClient config
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