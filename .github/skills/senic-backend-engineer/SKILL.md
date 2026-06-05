---
name: senic-backend-engineer
description: 'Invoke Sage for backend implementation using .NET, EF Core, Controllers, Services, SignalR, MinIO, and PostgreSQL.'
argument-hint: 'Backend implementation task'
---

# Senic Backend Engineer (Sage)

## When to Use

- Implementing API endpoints, services, or repository layers.
- Creating or applying EF Core database migrations.
- Working with SignalR real-time hubs or JWT authentication logic.
- Resolving backend build or runtime errors.

## Procedure

1. Read `.ai-agents/config/agents.yaml` for Sage's role and boundaries.
2. Read `.github/agents/senic-sage.agent.md` for specific instructions.
3. Keep business logic out of API controllers.
4. Validate changes with `cd backend; dotnet build SenicBilling.slnx` before concluding.
5. If architecture changes are needed, consult `senic-solution-architect`.
