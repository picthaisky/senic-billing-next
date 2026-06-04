# Agent Communication Protocol

## Purpose

Agents coordinate through compact, evidence-based handoffs. The goal is to keep work resumable, auditable, and easy for another agent or human to continue.

## Message Types

| Type | Sender | Receiver | Purpose |
| --- | --- | --- | --- |
| Intake Brief | Maestro | Specialists | Explain goal, scope, files, risks, and expected output |
| Specialist Finding | Specialist | Maestro | Return facts, recommendations, risks, and validation ideas |
| Implementation Handoff | Developer agent | QA/Security/Design agent | Explain changed paths, assumptions, and validation status |
| Review Finding | Reviewer | Implementer/Maestro | Flag bug, risk, missing test, or unclear behavior |
| Learning Update | Any agent | Mnemosyne | Suggest knowledge, pattern, decision, or anti-pattern updates |

## Standard Handoff

```yaml
handoff:
  task_id: SENIC-YYYYMMDD-short-name
  from_agent: senic-maestro
  to_agent: senic-ledger
  status: planned
  goal: "Describe the intended outcome in one sentence."
  affected_paths:
    - frontend/src/components/forms/InvoiceForm.tsx
    - backend/src/SenicBilling.API/Controllers/DocumentController.cs
  constraints:
    - "Thai-first UI copy"
    - "Maintain decimal(18,4) equivalence with backend"
  questions:
    - "Question that blocks a correct decision, if any"
  findings:
    - "Evidence-backed fact"
  risks:
    - risk: "What could go wrong"
      mitigation: "How to reduce it"
  validation:
    planned:
      - "cd frontend; npm run build"
    completed: []
  output_needed: "Exact output expected from receiving agent"
```

## Review Finding Format

```yaml
finding:
  severity: critical | high | medium | low
  path: "workspace-relative/path"
  issue: "What is wrong"
  evidence: "Why this is true"
  impact: "User, security, financial, or operational impact"
  recommendation: "Smallest practical fix"
  test_gap: "Missing validation, if any"
```

## Rules

- Prefer evidence from code, docs, tests, commands, or user decisions.
- Do not pass secrets, production credentials, real customer data, or private payment data in handoffs.
- If an agent is uncertain, it must name the uncertainty and propose the cheapest disambiguating check.
- Every final implementation handoff must include validation run or an explicit reason it was not run.
