---
name: senic-agent-orchestration
description: 'Coordinate Senic Billing multi-agent work. Use for complex features, cross-cutting changes, architecture reviews, implementation plans, security/QA/devops routing, and automated handoffs between Senic agents.'
argument-hint: 'Senic Billing task to orchestrate'
---

# Senic Agent Orchestration

## When to Use

- New features that touch more than one module.
- Bug fixes with unclear root cause.
- Architecture, API, data, payment, security, UX, deployment, or testing tradeoffs.
- Work that needs several specialists to coordinate without losing context.

## Procedure

1. Read `.ai-agents/README.md` and `.ai-agents/config/orchestrator.yaml`.
2. Build an intake brief with goal, affected modules, risk level, candidate files, and validation plan.
3. Route to specialists according to `.ai-agents/config/agents.yaml`.
4. Use `.ai-agents/config/agent-communication.md` for handoffs.
5. Require relevant quality gates before finalizing.
6. Validate with the narrowest feasible command.
7. Trigger `senic-learning-cycle` when the work creates reusable knowledge.

## Quality Gates

- Athena: requirements and acceptance criteria.
- Atlas: architecture and contracts.
- Ledger: billing, VAT, payment, lifecycle, numbering.
- Aegis: tenant isolation, auth, secrets, webhooks, uploads.
- Milo: Thai-first UX, design system, mobile, print/PDF.
- Argus: tests and regression coverage.
- Hermes: deployment and release readiness.
- Mnemosyne: learning capture.
