namespace SenicBilling.Domain.Entities;

/// <summary>
/// Platform-wide announcement created by Super Admin and displayed to active SME tenants.
/// </summary>
public class PlatformAnnouncement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    /// <summary>Info, Warning, Critical</summary>
    public string Severity { get; set; } = "Info";
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

