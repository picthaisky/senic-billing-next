using SenicBilling.Domain.Entities;

namespace SenicBilling.Application.Interfaces;

public interface ILineNotifyService
{
    /// <summary>LINE Notify (legacy token-based notification)</summary>
    Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default);

    /// <summary>LINE Messaging API — Push Message to a userId / groupId</summary>
    Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default);

    /// <summary>LINE Messaging API — Reply to a webhook event using its replyToken</summary>
    Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default);

    /// <summary>
    /// ส่งแจ้งเตือนไปยังองค์กร: ใช้ LINE Messaging API (Push) เมื่อมี Channel Access Token + Target Id
    /// และ fallback เป็น LINE Notify เมื่อมีเพียง LineNotifyToken
    /// </summary>
    Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default);
}

public static class LineConfigExtensions
{
    public static bool HasLineMessagingPush(this Tenant tenant) =>
        !string.IsNullOrWhiteSpace(tenant.LineChannelAccessToken) && !string.IsNullOrWhiteSpace(tenant.LineDefaultTargetId);

    public static bool HasAnyLineChannel(this Tenant tenant) =>
        tenant.HasLineMessagingPush() || !string.IsNullOrWhiteSpace(tenant.LineNotifyToken);
}
