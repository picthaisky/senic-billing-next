# Project-Specific Skills and Playbooks

This directory (`.ai-agents/skills/`) contains project-specific workflows, checklists, and playbooks that the Senic Billing Next AI Agents use to perform complex or high-risk tasks.

## Difference from `.github/skills/`

- **`.github/skills/`**: Defines the actual GitHub Copilot extensions/skills that a user can type (e.g., `/senic-frontend-engineer`). These files instruct the Copilot model on how to route tasks to our custom AI agents.
- **`.ai-agents/skills/`**: Contains the deep, domain-specific playbooks that the agents themselves read when executing a task (e.g., `payment-webhook-verification-playbook.md`). 

## How to Add a New Playbook

1. Use the `playbook-template.md` as a starting point.
2. Ensure the playbook has a clear trigger, scope, required evidence, and output format as mandated by the `README.md`.
3. Do not store secrets, real customer data, or private webhook payloads in these playbooks.
