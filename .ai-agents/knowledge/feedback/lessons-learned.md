# Lessons Learned

This log stores validated feedback, bug lessons, review findings, and agent workflow improvements.

## Entry Template

```markdown
## YYYY-MM-DD - Short Title

- Type: bug-lesson | review-finding | user-feedback | workflow-improvement | deprecated-assumption
- Source: code | docs | test | user | incident | review
- Evidence: path, command, or user decision
- Confidence: low | medium | high
- Lesson: One actionable sentence
- Follow-up: Optional next action
```

## 2026-06-04 - Multi-Agent System Bootstrapped

- Type: workflow-improvement
- Source: docs and repository structure
- Evidence: `.ai-agents/README.md`, `.github/agents/`, `.github/prompts/`, `.github/skills/`
- Confidence: high
- Lesson: Senic Billing work should route through specialist agents for billing, tenant, UX, QA, security, deployment, and learning risks.
- Follow-up: After the next real feature or bug fix, capture whether routing rules need refinement.
