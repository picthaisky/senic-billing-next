namespace SenicBilling.Application.DTOs;

// ── Audit Log Explorer (Sprint 12.2) ──
public record AuditLogItemDto(
    Guid Id,
    string Username,
    string Action,
    string EntityName,
    string EntityId,
    string? OldValues,
    string? NewValues,
    DateTime Timestamp);

public record AuditLogStatsDto(
    int TotalLogs,
    int TodayLogs,
    int DistinctUsers,
    DateTime? LatestTimestamp);

public record AuditLogPageDto(
    List<AuditLogItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    AuditLogStatsDto Stats);

public record AuditLogFiltersDto(
    List<string> EntityNames,
    List<string> Actions);

// ── Super Admin Platform Announcements & Operations (Sprint 12.3) ──
public record PlatformAnnouncementDto(
    Guid Id,
    string Title,
    string Message,
    string Severity,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    string? CreatedBy,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record UpsertAnnouncementRequest(
    string Title,
    string Message,
    string Severity = "Info",
    bool IsActive = true,
    DateTime? StartsAt = null,
    DateTime? EndsAt = null);

public record TenantImpersonationResultDto(
    string Token,
    Guid TenantId,
    string CompanyName,
    string Username,
    string DisplayName,
    string Role,
    string ImpersonatedBy,
    DateTime ExpiresAt,
    string? FrontendUrl = null);

