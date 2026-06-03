using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly SenicBillingDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IPushNotificationService _pushNotificationService;

    public NotificationsController(
        SenicBillingDbContext dbContext,
        IConfiguration configuration,
        IPushNotificationService pushNotificationService)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _pushNotificationService = pushNotificationService;
    }

    [HttpGet("vapid-public-key")]
    [AllowAnonymous] // Can be anonymous so frontend can prepare before login
    public IActionResult GetVapidPublicKey()
    {
        var publicKey = _configuration["Vapid:PublicKey"];
        return Ok(new { publicKey });
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionRequest request)
    {
        var userIdString = User.FindFirst("id")?.Value;
        if (!Guid.TryParse(userIdString, out var userId))
            return Unauthorized();

        // Check if subscription already exists for this endpoint
        var existing = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint);

        if (existing != null)
            return Ok(new { message = "Already subscribed" });

        var subscription = new PushSubscription
        {
            UserId = userId,
            Endpoint = request.Endpoint,
            P256dh = request.P256dh,
            Auth = request.Auth
        };

        _dbContext.PushSubscriptions.Add(subscription);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Subscribed successfully" });
    }

    [HttpDelete("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromQuery] string endpoint)
    {
        var userIdString = User.FindFirst("id")?.Value;
        if (!Guid.TryParse(userIdString, out var userId))
            return Unauthorized();

        var existing = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint && s.UserId == userId);

        if (existing != null)
        {
            _dbContext.PushSubscriptions.Remove(existing);
            await _dbContext.SaveChangesAsync();
        }

        return Ok(new { message = "Unsubscribed successfully" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestNotification()
    {
        var userIdString = User.FindFirst("id")?.Value;
        if (!Guid.TryParse(userIdString, out var userId))
            return Unauthorized();

        await _pushNotificationService.SendNotificationAsync(
            userId,
            "การทดสอบแจ้งเตือน! 🎉",
            "ระบบ Web Push ทำงานได้สมบูรณ์ สามารถกดเพื่อเข้าสู่ระบบได้เลย",
            "/dashboard"
        );

        return Ok(new { message = "Test notification sent" });
    }
}

public class PushSubscriptionRequest
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}
