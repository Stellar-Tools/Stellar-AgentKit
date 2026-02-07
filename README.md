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
  publicKey: process.env.STELLAR_PUBLIC_KEY
});

await agent.bridge({
  amount: "100",
  toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
});
```

**Response Format:**
```typescript
{
  status: "confirmed",           // or "trustline_submitted"
  hash: "transaction_hash",
  network: "stellar-mainnet",    // or "stellar-testnet"
  asset: "USDC",
  amount: "100"
}
```

**Best Practices:**

- ✅ Always test on testnet first
- ✅ Start with small amounts on mainnet
- ✅ Verify destination address multiple times
- ✅ Keep `ALLOW_MAINNET_BRIDGE` disabled by default
- ✅ Bridge operations are irreversible - double-check all parameters

**Supported Routes:**

- Stellar Testnet → Ethereum (Testnet)
- Stellar Mainnet → Ethereum (Mainnet) *requires `ALLOW_MAINNET_BRIDGE=true`*

---

## Supported Networks

- **Testnet** (full support) - No restrictions
- **Mainnet** (requires explicit configuration) - Real transactions

---

## 🧪 Testing
```bash
# Run test suite
npm test

# View test results
# ✅ 20/20 tests passed
# ✅ 100% success rate
```

---

## 📄 License

[Add your license here]

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 📞 Support

For issues or questions, please open an issue on GitHub.