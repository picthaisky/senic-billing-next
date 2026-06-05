---
name: senic-learning-cycle
description: 'Invoke Mnemosyne for self-learning workflow. Use after validated features, bug fixes, reviews, incidents, repeated patterns, ADRs, stale assumptions, or updates to project-specific agent skills and knowledge.'
argument-hint: 'Validated learning or completed work to capture'
---

# Senic Learning Cycle (Mnemosyne)

## When to Use

- A feature or bug fix has been validated.
- A review found a reusable risk or pattern.
- A validation failure revealed a missing rule.
- A project decision should become an ADR.
- Existing knowledge is stale or contradicted by code.

## Procedure

1. Read `.ai-agents/config/learning-engine.md`.
2. Check existing knowledge before adding a new entry.
3. Classify the learning as domain rule, pattern, decision, feedback, bug lesson, risk, or deprecated assumption.
4. Record source, evidence, confidence, and the actionable rule.
5. Update the smallest relevant file in `.ai-agents/knowledge/`.
6. Promote only broad, always-relevant rules to `.github/copilot-instructions.md`.
7. Never store secrets, tokens, real customer data, payment card data, or private webhook payloads.

## Output

Return:

- Knowledge file updated
- Evidence source
- Confidence level
- Agent/prompt/instruction update recommended
- Stale knowledge removed or marked
