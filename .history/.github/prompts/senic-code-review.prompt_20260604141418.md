---
name: "Senic Code Review"
description: "Review Senic Billing changes for bugs, security, billing correctness, architecture, UX, tests, and deployment risks."
agent: "senic-maestro"
argument-hint: "Files, diff, branch, or review focus"
---

Run a code review for the requested Senic Billing scope.

## Review Priorities

1. Correctness bugs and behavioral regressions.
2. Tenant isolation and security issues.
3. VAT, payment, document lifecycle, and document-numbering risks.
4. Clean Architecture boundary violations.
5. Thai-first UX, design-system, accessibility, mobile, and print/PDF risks.
6. Missing tests or validation evidence.
7. Deployment and environment risks.

## Output

Lead with findings ordered by severity. Include file paths, impact, recommendation, and missing tests. Keep summary secondary.
