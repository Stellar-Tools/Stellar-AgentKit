# Multi-Agent Orchestration Mode

Goal: split work into role-based agents with handoff protocol.

Define 4–6 agents:

- Product/PM Agent (scope, user flow, acceptance criteria)
- Backend Agent (API, DB, auth, integrations)
- AI/Logic Agent (deterministic core + eval)
- Frontend/UI Agent (screens, state, demo mode)
- Pitch/Demo Agent (script, narrative, slides notes)
  (Optional) DevOps Agent (deploy, env, CI)

For each agent:

- responsibilities
- inputs needed
- outputs produced
- constraints/cut-lines
- integration checkpoints

Handoff protocol:

- every output must be:
  - file list to create/edit
  - exact JSON/API contract
  - quick test/verification step
- "integration windows" (e.g., at hour 4, hour 8)

Also include:

- conflict resolution rule: API contract is source of truth
- quality gates: demo-safe, deterministic, offline fallback
