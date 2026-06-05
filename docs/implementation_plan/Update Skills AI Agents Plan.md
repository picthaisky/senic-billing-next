# Update Skills AI Agents Plan

This plan outlines the steps to comprehensively update and synchronize the AI Agent skills in the project.

## Proposed Changes

We will divide the work into three main areas:

### 1. Update Existing Skills
Update the existing core skills to ensure they strictly align with the latest `agents.yaml` and `README.md` definitions.
#### [MODIFY] .github/skills/senic-agent-orchestration/SKILL.md
- Refine the trigger conditions to match the `senic-maestro` orchestrator explicitly.
- Ensure the quality gates reference the exact names of the sub-agents.
#### [MODIFY] .github/skills/senic-learning-cycle/SKILL.md
- Refine the workflow to map directly to the `senic-mnemosyne` agent's responsibilities.

### 2. Create Missing Agent Skills
Create a dedicated Copilot skill for each specialist agent defined in `.ai-agents/config/agents.yaml`. This will allow you to explicitly invoke specific agents directly via Copilot skills.

#### [NEW] .github/skills/senic-business-analyst/SKILL.md
- Maps to `senic-athena`. Focus: Requirements, user stories, Thai SME workflows.
#### [NEW] .github/skills/senic-solution-architect/SKILL.md
- Maps to `senic-atlas`. Focus: Architecture, API boundaries, database design.
#### [NEW] .github/skills/senic-billing-specialist/SKILL.md
- Maps to `senic-ledger`. Focus: VAT, document lifecycle, payment, numbering.
#### [NEW] .github/skills/senic-backend-engineer/SKILL.md
- Maps to `senic-sage`. Focus: .NET, EF Core, Controllers, SignalR.
#### [NEW] .github/skills/senic-frontend-engineer/SKILL.md
- Maps to `senic-nova`. Focus: React, Zustand, UI implementation.
#### [NEW] .github/skills/senic-design-specialist/SKILL.md
- Maps to `senic-milo`. Focus: Thai-first UX, design system, mobile, accessibility.
#### [NEW] .github/skills/senic-qa-engineer/SKILL.md
- Maps to `senic-argus`. Focus: Testing, regressions, acceptance verification.
#### [NEW] .github/skills/senic-security-reviewer/SKILL.md
- Maps to `senic-aegis`. Focus: Auth, tenant isolation, webhooks.
#### [NEW] .github/skills/senic-devops-engineer/SKILL.md
- Maps to `senic-hermes`. Focus: CI/CD, Docker, release readiness.

### 3. Establish `.ai-agents/skills/` Directory
The `README.md` dictates that `.ai-agents/skills/` is for project-specific reusable workflows and playbooks.

#### [NEW] .ai-agents/skills/README.md
- A brief explanation of the directory's purpose (differentiating it from `.github/skills/`).
#### [NEW] .ai-agents/skills/playbook-template.md
- A template for defining a project-specific workflow (e.g., how to manually verify a payment webhook).

## Verification Plan

### Manual Verification
- Verify the folder structure matches the plan.
- Ensure Copilot can parse the new `SKILL.md` files (no syntax errors in frontmatter).
- Ensure the descriptions map correctly to the rules in `.github/copilot-instructions.md` and `.ai-agents/README.md`.
