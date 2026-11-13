---
name: senic-ai-automation-specialist
description: 'Invoke Senic AI Assistant, Background Automation & Notification Specialist for GeminiAIAssistantService, RecurringInvoiceWorker, OverdueMonitorWorker, SignalR, LINE Notify, Web Push, and Email.'
argument-hint: 'AI assistant, recurring worker, overdue monitor, or LINE/Push/Email notification task'
---

# Senic AI Assistant, Background Automation & Notification Specialist

## When to Use

- Modifying `AIAssistantController`, `GeminiAIAssistantService`, or `FloatingAIChat.tsx`.
- Working on `RecurringInvoiceWorker`, `OverdueMonitorWorker`, `SystemMonitorService`, or `RecurringInvoicesConfig.tsx`.
- Implementing or debugging LINE Notify, Web Push (`PushNotificationService`), SMTP Email (`SmtpEmailService`), or SignalR (`SenicBillingHub`).

## Procedure

1. Read `.github/agents/senic-ai-automation-specialist.agent.md` and `.ai-agents/skills/ai-workers-and-notifications-playbook.md`.
2. Verify strict `TenantId` scoping in AI context queries and SignalR group broadcasts (`Tenant_{tenantId}`).
3. Ensure background jobs and outbound notifications handle errors gracefully without failing core transactions.
4. Validate with `dotnet build` and `npm run build`.

