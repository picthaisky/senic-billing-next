---
name: senic-billing-specialist
description: 'Invoke Ledger for billing domain rules, VAT calculation, tax invoices, receipts, payment flows, and document numbering.'
argument-hint: 'Billing, VAT, or financial document logic'
---

# Senic Billing Specialist (Ledger)

## When to Use

- Adjusting VAT logic or decimal precision rules.
- Modifying document lifecycle state transitions (e.g., Quotation to Invoice).
- Changing document numbering behavior.
- Implementing payment webhooks or payment state management.

## Procedure

1. Read `.ai-agents/config/agents.yaml` for Ledger's role and boundaries.
2. Read `.github/agents/senic-ledger.agent.md` for specific instructions.
3. Apply rigorous financial invariants.
4. Ensure compliance with `.ai-agents/knowledge/domain-rules.md`.
5. For complex edge cases, delegate to specific subagents (e.g., vat-precision-auditor).
