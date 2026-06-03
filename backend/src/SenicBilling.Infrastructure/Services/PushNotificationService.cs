using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;
using SenicBilling.Infrastructure.Data;
using WebPush;

namespace SenicBilling.Infrastructure.Services;

public class PushNotificationService : IPushNotificationService
{
    private readonly SenicBillingDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(
        SenicBillingDbContext dbContext,
        IConfiguration configuration,
        ILogger<PushNotificationService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendNotificationAsync(Guid userId, string title, string message, string? url = null)
    {
        var subscriptions = await _dbContext.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        if (!subscriptions.Any()) return;

        await SendToSubscriptionsAsync(subscriptions, title, message, url);
    }

    public async Task SendNotificationToAllAsync(string title, string message, string? url = null)
    {
        var subscriptions = await _dbContext.PushSubscriptions.ToListAsync();
        if (!subscriptions.Any()) return;

        await SendToSubscriptionsAsync(subscriptions, title, message, url);
    }

    private async Task SendToSubscriptionsAsync(
        List<Domain.Entities.PushSubscription> subscriptions, 
        string title, 
        string message, 
        string? url)
    {
        var subject = _configuration["Vapid:Subject"];
        var publicKey = _configuration["Vapid:PublicKey"];
        var privateKey = _configuration["Vapid:PrivateKey"];

        if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(publicKey) || string.IsNullOrEmpty(privateKey))
        {
            _logger.LogWarning("VAPID keys are not configured properly.");
            return;
        }

        var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
        var webPushClient = new WebPushClient();

        var payload = JsonSerializer.Serialize(new
        {
            notification = new
            {
                title,
                body = message,
                icon = "/icon-192x192.png",
                badge = "/icon-192x192.png", // Optional: small icon for Android status bar
                vibrate = new[] { 100, 50, 100 },
                data = new
                {
                    url = url ?? "/" // Use data.url to open the app on click
                },
                actions = url != null ? new[]
                {
                    new { action = "open_url", title = "เปิดดู" }
                } : Array.Empty<object>()
            }
        });

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSubscription = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await webPushClient.SendNotificationAsync(pushSubscription, payload, vapidDetails);
                _logger.LogInformation("Sent push notification to {Endpoint}", sub.Endpoint);
            }
            catch (WebPushException ex)
            {
                _logger.LogError(ex, "Error sending push notification to {Endpoint}. StatusCode: {StatusCode}", sub.Endpoint, ex.StatusCode);
                
                // If subscription is gone, remove it from DB
                if (ex.StatusCode == System.Net.HttpStatusCode.Gone || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    _dbContext.PushSubscriptions.Remove(sub);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending push notification.");
            }
        }
    }
}
