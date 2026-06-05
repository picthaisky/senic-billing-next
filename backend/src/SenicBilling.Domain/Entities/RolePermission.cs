namespace SenicBilling.Domain.Entities;

public class RolePermission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>ชื่อ Role (e.g., Admin, Sales, Accountant)</summary>
    public string RoleName { get; set; } = string.Empty;

    public Guid PermissionId { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;
    public Permission Permission { get; set; } = null!;
}
