# Playbook: AI Assistant, Background Workers & Multi-Channel Notifications

## 1. Trigger & Scope
- **Trigger**: Any task modifying `AIAssistantController`, `GeminiAIAssistantService`, `FloatingAIChat.tsx`, `RecurringInvoiceWorker`, `OverdueMonitorWorker`, `SystemMonitorService`, `SenicBillingHub`, LINE Notify, Web Push (`PushNotificationService`), or `SmtpEmailService`.
- **Owner Agent**: `senic-ai-automation-specialist` (under `senic-sage` & `senic-hermes`)

## 2. Core Invariants
1. **AI Assistant Tenant Isolation**:
   - `AIAssistantController` must extract `tenantId` from the authenticated user's JWT claim and filter every database query by `TenantId == tenantId`.
   - If `Gemini:ApiKey` is not configured, return a polite Thai fallback message without throwing an unhandled 500 error.
2. **Background Hosted Services (`IHostedService` / `BackgroundService`)**:
   - Always resolve `SenicBillingDbContext` and scoped services inside `using var scope = _scopeFactory.CreateScope();`.
   - Wrap loop iterations in `try/catch (Exception ex)` with `ILogger` so transient DB/network errors never terminate the background worker.
3. **Multi-Channel Notifications**:
   - **SignalR**: Broadcast tenant-specific events (e.g., `PaymentReceived`) only to `Clients.Group($"Tenant_{tenantId}")`, never `Clients.All` for private financial events.
   - **LINE Notify**: When `Tenant.LineNotifyToken` is configured, send HTTP POST to `https://notify-api.line.me/api/notify` asynchronously inside a `try/catch` block so notification failures never abort payment webhook or document creation flows.
   - **Web Push & Email**: Fail gracefully with warning logs when VAPID or SMTP credentials are not configured in development.

## 3. Required Evidence & Validation
- Backend build: `cd backend; dotnet build SenicBilling.slnx`
- Frontend build: `cd frontend; npm run build`

