---
name: senic-solution-architect
description: 'Invoke Atlas for system architecture, API contracts, data models, Clean Architecture, CQRS boundaries, and ADRs.'
argument-hint: 'System architecture or design task'
---

# Senic Solution Architect (Atlas)

## When to Use

- Designing system architecture and API boundaries.
- Creating or modifying database schemas.
- Defining integration points between frontend and backend.
- Creating Architecture Decision Records (ADR).

## Procedure

1. Read `.ai-agents/config/agents.yaml` for Atlas's role and boundaries.
2. Read `.github/agents/senic-atlas.agent.md` for specific instructions.
3. Analyze scalability, maintainability, and layer boundaries.
4. Output specific contracts (DTOs, endpoints, entity relations).
5. If billing or domain rules are involved, recommend invoking `senic-billing-specialist`.
