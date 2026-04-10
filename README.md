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
- Native XLM and issued-asset payments
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

## 💸 Send Payments

`agent.sendPayment()` sends either native XLM or issued assets on Stellar
Classic using the configured Horizon network.

Highlights:

- Supports optional text memos
- Uses the configured `STELLAR_PRIVATE_KEY` only when it matches the source account
- Automatically falls back to `createAccount` when funding an unfunded address with native XLM
- Validates destination trustlines before issued-asset payments

```typescript
const payment = await agent.sendPayment({
  destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
  amount: "25.0000000",
  memo: "invoice-42"
});

const usdcPayment = await agent.sendPayment({
  destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
  amount: "10.5000000",
  asset: {
    code: "USDC",
    issuer: "G..."
  }
});
```

The `stellar_send_payment` tool exposes the same flow for agent/tooling use.

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
