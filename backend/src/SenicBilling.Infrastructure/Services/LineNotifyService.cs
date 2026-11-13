using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;

namespace SenicBilling.Infrastructure.Services;

/// <summary>
/// LINE integration: LINE Messaging API (Push / Reply) with automatic fallback to LINE Notify.
/// </summary>
public class LineNotifyService(HttpClient httpClient, ILogger<LineNotifyService> logger) : ILineNotifyService
{
    private const string LineNotifyEndpoint = "https://notify-api.line.me/api/notify";
    private const string LinePushEndpoint = "https://api.line.me/v2/bot/message/push";
    private const string LineReplyEndpoint = "https://api.line.me/v2/bot/message/reply";
    private const int LineTextMaxLength = 5000;

    public async Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, LineNotifyEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.Trim());
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["message"] = message
            });

            var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("LINE Notify returned non-success status code: {StatusCode}", response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send LINE Notify message");
            return false;
        }
    }

    public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to)) return Task.FromResult(false);
        return SendMessagingApiAsync(LinePushEndpoint, channelAccessToken, new { to = to.Trim(), messages = BuildTextMessages(message) }, ct);
    }

    public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(replyToken)) return Task.FromResult(false);
        return SendMessagingApiAsync(LineReplyEndpoint, channelAccessToken, new { replyToken, messages = BuildTextMessages(message) }, ct);
    }

    public async Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default)
    {
        if (tenant.HasLineMessagingPush())
        {
            var pushed = await PushMessageAsync(tenant.LineChannelAccessToken!, tenant.LineDefaultTargetId!, message.Trim(), ct);
            if (pushed) return true;
            logger.LogInformation("LINE Messaging push failed for tenant {TenantId}; falling back to LINE Notify", tenant.Id);
        }

        if (!string.IsNullOrWhiteSpace(tenant.LineNotifyToken))
        {
            return await SendNotificationAsync(tenant.LineNotifyToken, message, ct);
        }

        return false;
    }

    private static object[] BuildTextMessages(string message)
    {
        var text = message.Length > LineTextMaxLength ? message[..(LineTextMaxLength - 3)] + "..." : message;
        return [new { type = "text", text }];
    }

    private async Task<bool> SendMessagingApiAsync(string endpoint, string channelAccessToken, object payload, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(channelAccessToken)) return false;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", channelAccessToken.Trim());
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("LINE Messaging API {Endpoint} returned {StatusCode}", endpoint, response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to call LINE Messaging API {Endpoint}", endpoint);
            return false;
        }
    }
}
