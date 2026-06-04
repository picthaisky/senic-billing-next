---
name: "Senic Learning Retrospective"
description: "Capture validated Senic Billing lessons into knowledge files, patterns, decisions, feedback, or agent improvements."
agent: "senic-mnemosyne"
argument-hint: "Completed work, bug fix, review finding, or decision"
---

Run a learning retrospective for the provided completed work.

## Required Flow

1. Review existing `.ai-agents/knowledge/` entries to avoid duplication.
2. Classify the learning as domain rule, pattern, decision, feedback, bug lesson, risk, or deprecated assumption.
3. Capture evidence from docs, code, tests, command output, or user decision.
4. Update the smallest relevant file.
5. Recommend agent, prompt, or instruction updates only if future routing or behavior improves.

## Output

Return knowledge updated, evidence, confidence, and stale assumptions handled.
