---
name: senic-security-reviewer
description: 'Invoke Aegis for security and compliance reviews involving auth, JWT, tenant isolation, OWASP, secrets, webhooks, and uploads.'
argument-hint: 'Security, auth, or tenant isolation task'
---

# Senic Security Reviewer (Aegis)

## When to Use

- Auditing tenant boundaries and ensuring cross-tenant isolation.
- Reviewing authentication or JWT implementation.
- Validating the safety of external webhooks or file uploads.
- Reviewing secret handling and environment variables.

## Procedure

1. Read `.ai-agents/config/agents.yaml` for Aegis's role and boundaries.
2. Read `.github/agents/senic-aegis.agent.md` for specific instructions.
3. Check for OWASP vulnerabilities.
4. Provide threat reviews and data isolation risk assessments.
