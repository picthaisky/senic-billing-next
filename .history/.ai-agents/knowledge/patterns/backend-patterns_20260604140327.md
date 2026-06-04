# Backend Patterns

## Clean Architecture Boundaries

- Domain: entities, enums, business interfaces that do not depend on infrastructure.
- Application: DTOs and contracts used by API/service boundaries.
- Infrastructure: EF Core DbContext, migrations, persistence services, gateway clients, storage services.
- API: controllers, middleware, SignalR hubs, hosting configuration.

## EF Core Configuration

- Configure precision, relationships, indexes, enum conversions, and seed data in `SenicBillingDbContext`.
- Use composite indexes for tenant-scoped lookups that are frequent or uniqueness-sensitive.
- For new tenant-owned entities, add relationships to `Tenant` and indexes with `TenantId` first.

## Document Numbering

- Use a sequence table keyed by `TenantId`, `DocumentType`, and `YearMonth`.
- Preserve retry behavior around concurrency conflicts.
- Do not generate financial document numbers only on the client.

## API Controllers

- Keep controller actions thin when business logic grows.
- Return DTOs rather than exposing EF entities directly for complex or tenant-sensitive endpoints.
- Keep auth and tenant assumptions visible in controller/service logic.

## Integration Services

- Payment, storage, push, and external services belong behind interfaces.
- Gateway clients must handle failure and retry semantics deliberately.
- Webhook handlers must treat duplicate events as normal.