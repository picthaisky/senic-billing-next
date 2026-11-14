using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SenicBilling.API.Extensions;

namespace SenicBilling.API.Hubs;

[Authorize]
public class SenicBillingHub : Hub
{
    private readonly ILogger<SenicBillingHub> _logger;

    public SenicBillingHub(ILogger<SenicBillingHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.TryGetUserId()?.ToString();
        var tenantId = Context.User?.FindFirst("tenantId")?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            _logger.LogInformation("User {UserId} connected to SignalR Hub. ConnectionId: {ConnectionId}", userId, Context.ConnectionId);
            
            // Optionally add user to a Tenant group for tenant-wide broadcasts
            if (!string.IsNullOrEmpty(tenantId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}");
                await Clients.OthersInGroup($"Tenant_{tenantId}").SendAsync("UserPresenceChanged", userId, true);
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.TryGetUserId()?.ToString();
        var tenantId = Context.User?.FindFirst("tenantId")?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            _logger.LogInformation("User {UserId} disconnected from SignalR Hub. ConnectionId: {ConnectionId}", userId, Context.ConnectionId);

            if (!string.IsNullOrEmpty(tenantId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}");
                await Clients.OthersInGroup($"Tenant_{tenantId}").SendAsync("UserPresenceChanged", userId, false);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
