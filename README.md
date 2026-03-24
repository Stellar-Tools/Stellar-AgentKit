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

- Token swaps on Stellar
- Cross-chain bridging
- Liquidity pool (LP) deposits & withdrawals
- Querying pool reserves and share IDs
- **💸 XLM & custom asset payments** (multi-asset, memo support)
- **💰 Account balance queries** (XLM + all tokens)
- **🔍 Full account info** (sequence, signers, thresholds, flags)
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

## 💸 Payments & Account Info

AgentKit now supports sending payments and querying account balances directly through the `AgentClient`.

### Send XLM

```typescript
import { AgentClient } from "stellartools";

const agent = new AgentClient({
  network: "testnet",
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});

// STELLAR_PRIVATE_KEY must be set in your .env
const result = await agent.sendPayment({
  to: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGPZS1NPE6GUNLHGQLH1E7",
  amount: "10",
});
console.log(JSON.parse(result));
// { success: true, hash: "abc123...", network: "testnet", ... }
```

### Send a Custom Asset (e.g. USDC)

```typescript
const result = await agent.sendPayment({
  to: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGPZS1NPE6GUNLHGQLH1E7",
  amount: "50",
  asset_code: "USDC",
  asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  memo: "Invoice #42",
});
```

### Get Account Balance

```typescript
// Query your own balance
const result = await agent.getBalance();
const { balances } = JSON.parse(result);
console.log(balances);
// [
//   { asset: "XLM", balance: "99.9999600" },
//   { asset: "USDC:GA5ZS...", balance: "50.0000000" }
// ]

// Or query any public key
const result = await agent.getBalance("GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGPZS1NPE6GUNLHGQLH1E7");
```

### Get Full Account Info

```typescript
const result = await agent.getAccountInfo();
const info = JSON.parse(result);
console.log(info.sequence);      // "1234567890"
console.log(info.signers);       // [{ key: "GCEZ...", weight: 1, type: "ed25519_public_key" }]
console.log(info.balanceCount);  // 2
```

### Use as LangChain Tools

```typescript
import { stellarTools } from "stellartools";
// stellarTools now includes:
// - stellarSendPaymentTool  (multi-asset, memo, mainnet)
// - stellarGetBalanceTool   (XLM + tokens for any address)
// - stellarGetAccountInfoTool (full account details)
// - bridgeTokenTool, StellarContractTool, StellarLiquidityContractTool

// Pass to your LangChain agent
const agent = new ChatAgent({ tools: stellarTools });
```

### Mainnet Payments

```typescript
// Set ALLOW_MAINNET=true in your .env for mainnet payment safety gate
const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true,
  publicKey: process.env.STELLAR_PUBLIC_KEY,
});

// Will throw unless ALLOW_MAINNET=true is set in env
await agent.sendPayment({ to: "GCEZ...", amount: "1" });
```

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