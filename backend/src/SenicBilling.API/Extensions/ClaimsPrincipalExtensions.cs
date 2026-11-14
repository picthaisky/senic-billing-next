using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SenicBilling.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static readonly Guid PlatformOwnerTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public static bool TryGetTenantId(this ClaimsPrincipal user, out Guid tenantId)
    {
        var claim = user.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public static Guid GetTenantId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out var tenantId)
            ? tenantId
            : throw new UnauthorizedAccessException("Tenant ID claim not found");
    }

    public static Guid? TryGetUserId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? user.FindFirst("sub")?.Value
            ?? user.FindFirst("id")?.Value
            ?? user.FindFirst("userId")?.Value;

        return Guid.TryParse(claim, out var userId) ? userId : null;
    }

    public static Guid GetUserId(this ClaimsPrincipal user) =>
        user.TryGetUserId() ?? throw new UnauthorizedAccessException("User ID claim not found");

    public static string GetUsername(this ClaimsPrincipal user) =>
        user.Identity?.Name
        ?? user.FindFirst(ClaimTypes.Name)?.Value
        ?? user.FindFirst(JwtRegisteredClaimNames.UniqueName)?.Value
        ?? user.FindFirst("unique_name")?.Value
        ?? user.FindFirst("username")?.Value
        ?? "system";

    public static bool IsPlatformAdmin(this ClaimsPrincipal user)
    {
        if (user.IsInRole("SuperAdmin") || user.IsInRole("SystemAdmin"))
            return true;

        if (user.IsInRole("Admin"))
        {
            var claim = user.FindFirst("tenantId")?.Value;
            return Guid.TryParse(claim, out var tenantId) && tenantId == PlatformOwnerTenantId;
        }

        return false;
    }

    public static bool IsPlatformAdminUser(string role, Guid tenantId) =>
        role is "SuperAdmin" or "SystemAdmin"
        || (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) && tenantId == PlatformOwnerTenantId);
}

