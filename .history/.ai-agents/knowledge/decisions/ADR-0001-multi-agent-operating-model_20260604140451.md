# ADR-0001: Multi Agent Operating Model

Date: 2026-06-04

## Status

Accepted as prototype.

## Context

Senic Billing Next spans product analysis, Thai billing domain rules, React/PWA UX, .NET Clean Architecture, PostgreSQL data design, payment integration, SignalR monitoring, Docker deployment, and security-sensitive tenant isolation. A single generic assistant tends to lose boundaries across these concerns.

## Decision

Use a role-based Multi AI Agents model with one orchestrator (`senic-maestro`), specialist agents, and narrow subagents. Keep shared knowledge in `.ai-agents/knowledge/` and project-wide behavior in `.github/copilot-instructions.md`.

## Consequences

- Complex work starts with routing and quality gates.
- Billing, security, design, QA, and deployment risks get explicit specialist review.
- Reusable learnings are stored in versioned repository files.
- Agent files can be invoked from VS Code while remaining grounded in project-specific docs and code.

## Rejected Alternatives

- One large universal agent: simpler to invoke, but too prone to blurred responsibilities.
- Hidden memory only: convenient, but not reviewable by the project team.
- Root `AGENTS.md` plus `.github/copilot-instructions.md`: rejected for now to avoid duplicate always-on instruction sources in this prototype.
