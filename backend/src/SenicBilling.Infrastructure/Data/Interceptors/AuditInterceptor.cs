using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using System.Text.Json;
using SenicBilling.Domain.Entities;

namespace SenicBilling.Infrastructure.Data.Interceptors;

public class AuditInterceptor(IHttpContextAccessor httpContextAccessor) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, 
        InterceptionResult<int> result, 
        CancellationToken cancellationToken = default)
    {
        var dbContext = eventData.Context;
        if (dbContext is null) return base.SavingChangesAsync(eventData, result, cancellationToken);

        var entries = dbContext.ChangeTracker.Entries()
            .Where(e => e.Entity is not AuditLog && 
                        e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        if (entries.Count == 0) return base.SavingChangesAsync(eventData, result, cancellationToken);

        var username = httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "System";
        var tenantIdClaim = httpContextAccessor.HttpContext?.User?.FindFirst("tenantId")?.Value;
        Guid.TryParse(tenantIdClaim, out var tenantId);
        
        if (tenantId == Guid.Empty)
        {
            // If no tenant context, try to infer from the first entity if it has a TenantId
            var firstEntity = entries.FirstOrDefault()?.Entity;
            if (firstEntity is not null)
            {
                var tenantIdProp = firstEntity.GetType().GetProperty("TenantId");
                if (tenantIdProp != null)
                {
                    var value = tenantIdProp.GetValue(firstEntity);
                    if (value is Guid guid)
                    {
                        tenantId = guid;
                    }
                }
            }
        }

        var auditLogs = new List<AuditLog>();

        foreach (var entry in entries)
        {
            var entityName = entry.Entity.GetType().Name;
            var action = entry.State.ToString();
            
            // Get primary key
            var primaryKey = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
            var entityId = primaryKey?.CurrentValue?.ToString() ?? "Unknown";

            var oldValues = entry.State == EntityState.Added ? null : GetOldValues(entry);
            var newValues = entry.State == EntityState.Deleted ? null : GetNewValues(entry);

            auditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId == Guid.Empty ? Guid.Parse("00000000-0000-0000-0000-000000000001") : tenantId, // Fallback for safety
                Username = username,
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                Timestamp = DateTime.UtcNow
            });
        }

        dbContext.Set<AuditLog>().AddRange(auditLogs);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static Dictionary<string, object?> GetOldValues(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var result = new Dictionary<string, object?>();
        foreach (var prop in entry.Properties)
        {
            if (prop.IsModified || entry.State == EntityState.Deleted)
            {
                result[prop.Metadata.Name] = prop.OriginalValue;
            }
        }
        return result;
    }

    private static Dictionary<string, object?> GetNewValues(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var result = new Dictionary<string, object?>();
        foreach (var prop in entry.Properties)
        {
            if (prop.IsModified || entry.State == EntityState.Added)
            {
                result[prop.Metadata.Name] = prop.CurrentValue;
            }
        }
        return result;
    }
}
