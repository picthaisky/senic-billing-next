using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.Auth;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IServiceProvider _serviceProvider;

    public PermissionAuthorizationHandler(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, 
        PermissionRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var roleClaim = context.User.FindFirst(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
        var tenantClaim = context.User.FindFirst("tenantId")?.Value;

        if (string.IsNullOrEmpty(roleClaim) || string.IsNullOrEmpty(tenantClaim))
        {
            return;
        }

        // Admin has all permissions
        if (roleClaim == "Admin")
        {
            context.Succeed(requirement);
            return;
        }

        if (!Guid.TryParse(tenantClaim, out var tenantId))
        {
            return;
        }

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();

        var hasPermission = await dbContext.RolePermissions
            .Include(rp => rp.Permission)
            .AnyAsync(rp => 
                rp.TenantId == tenantId && 
                rp.RoleName == roleClaim && 
                rp.Permission.Name == requirement.Permission);

        if (hasPermission)
        {
            context.Succeed(requirement);
        }
    }
}
