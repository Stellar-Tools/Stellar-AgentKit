# Hackathon Winner Pack: Pitch & Demo Scripts 🏆

This document provides the winning narrative and scripts to present Stellar AgentKit effectively to judges and stakeholders.

---

## 🏗️ The Win DNA (Why We Win)

- **Problem**: Autonomous agents struggle on-chain due to network instability (timeouts), complex setup (trustlines), and fragmented tools.
- **Solution**: Stellar AgentKit provides a "Resilient DeFi Framework" that handles retries, auto-trustlines, and cross-chain bridging autonomously.
- **Impact**: Developers can build agents in minutes that are as reliable as centralized systems.

---

## ⏱️ 90-Second Elevator Pitch

**Goal: Hook the judges immediately.**

"Hi, we are building **Stellar AgentKit**. Everyone is talking about AI agents, but when an agent tries to trade on-chain, it breaks. Why? Because the blockchain is messy—networks timeout, rate limits hit, and trustlines are missing.

We’ve built an industry-grade SDK that gives agents **DeFi Autopilot**.

1. **Resilience**: Our built-in exponential backoff handles network errors automatically.
2. **Intelligence**: Agents detect and open trustlines otonomously before a trade fails.
3. **Versatility**: From staking to cross-chain bridging, we’ve unified the entire Stellar DeFi stack.

With AgentKit, we’re not just making agents—we’re making agents that actually work."

---

## 🎬 3-Minute Demo Script

**Goal: Show, don't just tell.**

1. **[0:00-0:45] Intro & Portfolio**:
   - "Watch as our agent initializes. It immediately checks balances across multiple assets. Notice how it identifies that XLM is low but USDC is high."
2. **[0:45-1:30] Autonomous Resilience**:
   - "Traditional bots would fail here if the network was busy. Our agent encounters a rate limit—but look—it automatically waits, backs off, and retries until it succeeds. No manual intervention."
3. **[1:30-2:15] The 'Magic' Moment (Trustlines)**:
   - "Now, the agent wants to bridge USDC to Ethereum. It notices a missing trustline. Instead of crashing, it invokes our `ensure_trustline` tool, sets up the environment, and proceeds with the bridge. This is true autonomy."
4. **[2:15-3:00] Conclusion**:
   - "We’ve unified swaps, staking, and bridging into a single `AgentClient`. Stellar AgentKit is the foundation for the next generation of autonomous finance on Stellar."

---

## ❓ Frequently Asked Questions (FAQ)

**Q: How does this differ from the standard Stellar SDK?**
A: Standard SDKs are low-level. AgentKit is a high-level "Resilience Layer" specifically designed for AI agents that need to handle errors and environment setup without human help.

**Q: Is it safe for Mainnet?**
A: Yes. We implemented a "Dual-Safeguard" system. Mainnet actions require explicit opt-in at both the code and environment level.

**Q: Can I bridge any asset?**
A: Yes, our Phase 4 update added multi-asset support. You just need to provide the asset symbol.

---

## 🚀 Final Tip: The "Mic Drop"

When ending your demo, show the **Multi-Agent Orchestrator** code (`examples/orchestrator.ts`). Say:
_"We don't just have tools; we have a hiyerarşisi where an Analyst agent thinks and an Executor agent does. This is the future."_
