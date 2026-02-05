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

## Quick Start

### Testnet (Safe for Testing)
```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "testnet",
});

await agent.swap({
  from: "USDC",
  to: "XLM",
  amount: "100",
});
```

### Mainnet (Real Funds - Requires Explicit Opt-in)

⚠️ **Safety Notice:** Mainnet operations require the `allowMainnet: true` flag to prevent accidental execution with real funds.
```typescript
import { AgentClient } from "stellar-agentkit";

const agent = new AgentClient({
  network: "mainnet",
  allowMainnet: true, // ⚠️ Required for mainnet
});

await agent.swap({
  from: "USDC",
  to: "XLM",
  amount: "100",
});
```

**Without the `allowMainnet` flag, you'll receive an error:**
```
🚫 Mainnet execution blocked for safety.
Stellar AgentKit requires explicit opt-in for mainnet operations to prevent accidental use of real funds.
To enable mainnet, set allowMainnet: true in your config.
```

---

## Supported Networks

- **Testnet** (full support) - No restrictions
- **Mainnet** (requires `allowMainnet: true`) - Real transactions

---