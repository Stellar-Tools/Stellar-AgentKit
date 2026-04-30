# Contributing to Stellar AgentKit

Thank you for your interest in contributing to **Stellar AgentKit** 🎉  
This project is an open-source SDK and platform designed to simplify
complex DeFi operations on the Stellar blockchain.

Because this project interacts with financial infrastructure,
we follow **high standards for code quality, security, and review**.

---

## 📌 Table of Contents

- Project Philosophy
- Repository Structure
- Development Setup
- Coding Standards
- Branching & Commits
- Testing Guidelines
- Security Expectations
- Pull Request Process
- Issue Guidelines
- Roadmap Alignment

---

## 🌟 Project Philosophy

Stellar AgentKit aims to:

- Abstract complexity without hiding important details
- Favor explicitness over magic
- Be safe by default
- Remain extensible for future protocols and tools

Contributors are expected to:
- Think in terms of long-term maintainability
- Avoid shortcuts that reduce clarity or safety
- Prioritize developer experience (DX)

---

## 🗂 Repository Structure

High-level structure:

src/ → Core SDK source
dist/ → Compiled output
examples/ → Real usage examples
docs/ → Developer documentation
tests/ → Unit & integration tests


Please do not:
- Add logic directly to `dist/`
- Mix unrelated concerns in the same module
- Introduce breaking API changes without discussion

---

## ⚙️ Development Setup

### Prerequisites
- Node.js ≥ 18
- npm / bun
- Familiarity with Stellar & Soroban concepts

### Setup
```bash
git clone https://github.com/<org>/stellar-agentkit.git
cd stellar-agentkit
npm install
npm run build
```

🧑‍💻 Coding Standards

Use TypeScript for all new code

Prefer explicit types over any

Avoid side effects in utility functions

Follow existing patterns and naming conventions

Style Rules

Small, composable functions

Clear error messages

No silent failures

Avoid unnecessary abstractions

🌿 Branching & Commits
Branch Naming
feature/<short-description>
fix/<short-description>
docs/<short-description>

Commit Messages

Use clear, descriptive commits:

feat: add mainnet bridge config
fix: handle LP withdrawal edge case
docs: update bridge usage examples


Avoid:

update

fix stuff

wip

🧪 Testing Guidelines

Because AgentKit handles financial operations:

New logic must include tests or examples

Mainnet-related logic must be gated and explicit

Tests should be deterministic where possible

Required for:

Bridge logic

LP interactions

Transaction construction

Network switching

🔐 Security Expectations

Security is a top priority.

Do NOT:

Hardcode private keys

Commit secrets or credentials

Expose sensitive transaction data

Assume testnet logic is safe for mainnet

If you find a vulnerability:

Follow the Security Policy

Do NOT open a public issue

🔁 Pull Request Process

Fork the repository

Create a feature branch

Make your changes

Add tests/examples

Ensure build passes

Open a Pull Request

PRs should:

Clearly explain what and why

Reference related issues

Avoid unrelated changes

Maintainers may request changes before merge.

🐛 Issue Guidelines
When opening an issue:

Use a clear, descriptive title

Provide context and expected behavior

Include repro steps if applicable

Feature requests should include:

Motivation

Proposed API

Alternatives considered

🧭 Roadmap Alignment

Before starting large features:

Check open issues and milestones

Open a discussion if unsure

Avoid major rewrites without consensus

We aim to keep the SDK stable and predictable.

🙌 Community Expectations

All contributors must follow the
Code of Conduct
.

Be respectful, constructive, and collaborative.

🚀 Thank You

Your contributions help make Stellar AgentKit safer,
more powerful, and easier to use for everyone.
