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
or

bun add stellartools
```

## Quick Start
```
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

## Supported Networks
Testnet (full support)
Mainnet (transactions)

