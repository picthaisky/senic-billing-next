---
name: "Senic Bug Fix"
description: "Diagnose and fix a Senic Billing bug with root-cause analysis, focused validation, regression scenarios, and learning capture."
agent: "senic-maestro"
argument-hint: "Bug report, failing behavior, or error output"
---

Run the Senic bug-fix workflow.

## Required Flow

1. Identify the concrete failing behavior, command, route, endpoint, or component.
2. Form one local hypothesis and one cheap disconfirming check.
3. Consult the smallest needed specialists: Ledger for billing, Aegis for security/tenant, Milo for UI, Hermes for runtime/deployment.
4. Make the smallest root-cause fix.
5. Run the narrowest validation that could fail the hypothesis.
6. Ask Argus for regression scenarios when the bug affects user-visible or financial behavior.
7. Ask Mnemosyne to capture the bug lesson if it is reusable.

## Output

Return root cause, fix summary, validation result, and regression coverage.
