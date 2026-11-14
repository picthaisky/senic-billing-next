using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;

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

    [HttpGet("feed")]
    public async Task<ActionResult<ApiResponse<List<NotificationFeedItemDto>>>> GetFeed(
        [FromQuery] int limit = 15,
        CancellationToken ct = default)
    {
        var tenantId = User.GetTenantId();
        var now = DateTime.UtcNow;
        var items = new List<NotificationFeedItemDto>();

        var overdueDocs = await _dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId
                && d.DocumentType != DocumentType.Quotation
                && d.Status != DocumentStatus.Paid
                && d.Status != DocumentStatus.Cancelled
                && (d.Status == DocumentStatus.Overdue || (d.DueDate.HasValue && d.DueDate.Value < now)))
            .OrderByDescending(d => d.DueDate ?? d.DocumentDate)
            .Take(6)
            .Select(d => new
            {
                d.Id,
                d.DocumentNumber,
                d.DocumentType,
                d.CustomerName,
                d.GrandTotal,
                d.DueDate,
                d.DocumentDate
            })
            .ToListAsync(ct);

        foreach (var doc in overdueDocs)
        {
            var occurredAt = doc.DueDate ?? doc.DocumentDate;
            items.Add(new NotificationFeedItemDto(
                Id: $"overdue-{doc.Id}",
                Title: $"เกินกำหนดชำระ {doc.DocumentNumber}",
                Detail: $"{doc.CustomerName ?? "ลูกค้า"} • ฿{doc.GrandTotal:N2}",
                TimeLabel: FormatRelativeThai(occurredAt, now),
                OccurredAt: occurredAt,
                Tone: "danger",
                Route: $"/documents/{doc.DocumentType.ToString().ToLowerInvariant()}"
            ));
        }

        var dueSoonCutoff = now.AddDays(3);
        var dueSoonDocs = await _dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId
                && d.DocumentType != DocumentType.Quotation
                && (d.Status == DocumentStatus.Issued || d.Status == DocumentStatus.Sent || d.Status == DocumentStatus.Viewed)
                && d.DueDate.HasValue
                && d.DueDate.Value >= now
                && d.DueDate.Value <= dueSoonCutoff)
            .OrderBy(d => d.DueDate)
            .Take(4)
            .Select(d => new
            {
                d.Id,
                d.DocumentNumber,
                d.DocumentType,
                d.CustomerName,
                d.GrandTotal,
                DueDate = d.DueDate!.Value
            })
            .ToListAsync(ct);

        foreach (var doc in dueSoonDocs)
        {
            items.Add(new NotificationFeedItemDto(
                Id: $"duesoon-{doc.Id}",
                Title: $"ใกล้ครบกำหนด {doc.DocumentNumber}",
                Detail: $"{doc.CustomerName ?? "ลูกค้า"} • ฿{doc.GrandTotal:N2}",
                TimeLabel: doc.DueDate.ToString("dd/MM/yyyy"),
                OccurredAt: doc.DueDate,
                Tone: "warning",
                Route: $"/documents/{doc.DocumentType.ToString().ToLowerInvariant()}"
            ));
        }

        var approvals = await _dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId
                && d.ApprovedAt.HasValue
                && (d.CustomerApprovalStatus == CustomerApprovalStatus.Approved || d.CustomerApprovalStatus == CustomerApprovalStatus.Rejected))
            .OrderByDescending(d => d.ApprovedAt)
            .Take(5)
            .Select(d => new
            {
                d.Id,
                d.DocumentNumber,
                d.DocumentType,
                d.CustomerApprovalStatus,
                d.ApprovedByName,
                ApprovedAt = d.ApprovedAt!.Value
            })
            .ToListAsync(ct);

        foreach (var approval in approvals)
        {
            var isApproved = approval.CustomerApprovalStatus == CustomerApprovalStatus.Approved;
            items.Add(new NotificationFeedItemDto(
                Id: $"approval-{approval.Id}",
                Title: isApproved
                    ? $"ลูกค้าอนุมัติเอกสาร {approval.DocumentNumber}"
                    : $"ลูกค้าขอแก้ไขเอกสาร {approval.DocumentNumber}",
                Detail: string.IsNullOrWhiteSpace(approval.ApprovedByName)
                    ? "ดำเนินการผ่านลิงก์ออนไลน์"
                    : $"ผู้ดำเนินการ: {approval.ApprovedByName}",
                TimeLabel: FormatRelativeThai(approval.ApprovedAt, now),
                OccurredAt: approval.ApprovedAt,
                Tone: isApproved ? "success" : "warning",
                Route: $"/documents/{approval.DocumentType.ToString().ToLowerInvariant()}"
            ));
        }

        var paidDocs = await _dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.Status == DocumentStatus.Paid)
            .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
            .Take(5)
            .Select(d => new
            {
                d.Id,
                d.DocumentNumber,
                d.DocumentType,
                d.CustomerName,
                d.GrandTotal,
                PaidAt = d.UpdatedAt ?? d.CreatedAt
            })
            .ToListAsync(ct);

        foreach (var paid in paidDocs)
        {
            items.Add(new NotificationFeedItemDto(
                Id: $"paid-{paid.Id}",
                Title: $"รับชำระเงินแล้ว {paid.DocumentNumber}",
                Detail: $"{paid.CustomerName ?? "ลูกค้าทั่วไป"} • ฿{paid.GrandTotal:N2}",
                TimeLabel: FormatRelativeThai(paid.PaidAt, now),
                OccurredAt: paid.PaidAt,
                Tone: "success",
                Route: $"/documents/{paid.DocumentType.ToString().ToLowerInvariant()}"
            ));
        }

        var lowStocks = await _dbContext.ProductWarehouseStocks
            .AsNoTracking()
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Where(s => s.TenantId == tenantId && s.ReorderLevel > 0 && s.Quantity <= s.ReorderLevel)
            .OrderBy(s => s.Quantity)
            .Take(5)
            .Select(s => new
            {
                s.Id,
                ProductName = s.Product.Name,
                WarehouseName = s.Warehouse.Name,
                s.Quantity,
                s.ReorderLevel,
                s.UpdatedAt
            })
            .ToListAsync(ct);

        foreach (var stock in lowStocks)
        {
            items.Add(new NotificationFeedItemDto(
                Id: $"stock-{stock.Id}",
                Title: $"สต็อกสินค้าใกล้หมด: {stock.ProductName}",
                Detail: $"{stock.WarehouseName} • คงเหลือ {stock.Quantity:N0} (ขั้นต่ำ {stock.ReorderLevel:N0})",
                TimeLabel: FormatRelativeThai(stock.UpdatedAt, now),
                OccurredAt: stock.UpdatedAt,
                Tone: "warning",
                Route: "/warehouses"
            ));
        }

        var ordered = items
            .OrderByDescending(i => i.OccurredAt)
            .Take(Math.Clamp(limit, 1, 30))
            .ToList();

        return Ok(new ApiResponse<List<NotificationFeedItemDto>>(
            true,
            $"พบการแจ้งเตือน {ordered.Count} รายการ",
            ordered));
    }

    private static string FormatRelativeThai(DateTime timestampUtc, DateTime nowUtc)
    {
        var diff = nowUtc - timestampUtc;
        if (diff.TotalMinutes < 1) return "เมื่อสักครู่";
        if (diff.TotalMinutes < 60) return $"{Math.Max(1, (int)diff.TotalMinutes)} นาทีที่แล้ว";
        if (diff.TotalHours < 24) return $"{(int)diff.TotalHours} ชั่วโมงที่แล้ว";
        if (diff.TotalDays < 30) return $"{(int)diff.TotalDays} วันที่แล้ว";
        return timestampUtc.ToString("dd/MM/yyyy");
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionRequest request)
    {
        var maybeUserId = User.TryGetUserId();
        if (maybeUserId is not { } userId)
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
        var maybeUserId = User.TryGetUserId();
        if (maybeUserId is not { } userId)
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
        var maybeUserId = User.TryGetUserId();
        if (maybeUserId is not { } userId)
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
