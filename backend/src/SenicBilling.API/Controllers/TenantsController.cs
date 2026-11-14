using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantsController : ControllerBase
{
    private const string LogoBucketName = "senic-billing-logos";
    private const long MaxLogoSizeBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedLogoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp"
    };

    private readonly SenicBillingDbContext dbContext;
    private readonly ILineNotifyService lineNotifyService;
    private readonly IStorageService? _storageService;
    private readonly IWebHostEnvironment? _environment;

    public TenantsController(SenicBillingDbContext dbContext, ILineNotifyService lineNotifyService)
        : this(dbContext, lineNotifyService, null, null)
    {
    }

    [ActivatorUtilitiesConstructor]
    public TenantsController(
        SenicBillingDbContext dbContext,
        ILineNotifyService lineNotifyService,
        IStorageService? storageService,
        IWebHostEnvironment? environment)
    {
        this.dbContext = dbContext;
        this.lineNotifyService = lineNotifyService;
        _storageService = storageService;
        _environment = environment;
    }

    private Guid GetTenantId() => User.GetTenantId();

    [HttpGet("current")]
    public async Task<ActionResult<ApiResponse<TenantProfileDto>>> GetCurrentTenant(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound(new ApiResponse<TenantProfileDto>(false, "ไม่พบข้อมูลองค์กร", null));

        return Ok(new ApiResponse<TenantProfileDto>(true, "สำเร็จ", MapToDto(tenant)));
    }

    [HttpPut("profile")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<TenantProfileDto>>> UpdateProfile([FromBody] UpdateTenantProfileRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound(new ApiResponse<TenantProfileDto>(false, "ไม่พบข้อมูลองค์กร", null));

        var oldValues = JsonSerializer.Serialize(new
        {
            tenant.CompanyName,
            tenant.TaxId,
            tenant.Email,
            tenant.Phone,
            tenant.BranchName
        });

        tenant.CompanyName = req.CompanyName;
        tenant.TaxId = req.TaxId;
        tenant.Email = req.Email;
        tenant.Phone = req.Phone;
        tenant.Address = req.Address;
        tenant.BranchName = req.BranchName;
        tenant.LineNotifyToken = req.LineNotifyToken;
        if (!string.IsNullOrWhiteSpace(req.LineChannelAccessToken))
            tenant.LineChannelAccessToken = req.LineChannelAccessToken.Trim();
        if (!string.IsNullOrWhiteSpace(req.LineChannelSecret))
            tenant.LineChannelSecret = req.LineChannelSecret.Trim();
        if (req.LineDefaultTargetId != null)
            tenant.LineDefaultTargetId = string.IsNullOrWhiteSpace(req.LineDefaultTargetId) ? null : req.LineDefaultTargetId.Trim();
        if (req.LogoUrl != null) tenant.LogoUrl = req.LogoUrl;
        
        tenant.UpdatedAt = DateTime.UtcNow;

        var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "Admin";
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Action = "UpdateTenantProfile",
            EntityName = "Tenant",
            EntityId = tenantId.ToString(),
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new
            {
                tenant.CompanyName,
                tenant.TaxId,
                tenant.Email,
                tenant.Phone,
                tenant.BranchName
            }),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<TenantProfileDto>(true, "อัปเดตข้อมูลองค์กรสำเร็จ", MapToDto(tenant)));
    }

    [HttpPost("test-line-notify")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> TestLineNotify(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null || !tenant.HasAnyLineChannel())
        {
            return BadRequest(new ApiResponse<bool>(false, "ยังไม่ได้ตั้งค่า LINE Messaging API หรือ LINE Notify Token", false));
        }

        var sent = await lineNotifyService.NotifyTenantAsync(
            tenant,
            $"\nทดสอบการแจ้งเตือนจาก {tenant.CompanyName} (Senic Billing Next)",
            ct);

        return sent
            ? Ok(new ApiResponse<bool>(true, "ส่งข้อความทดสอบ LINE สำเร็จ", true))
            : BadRequest(new ApiResponse<bool>(false, "ไม่สามารถส่งข้อความ LINE ได้ กรุณาตรวจสอบการตั้งค่า", false));
    }

    /// <summary>Export tenant-scoped JSON backup datasets packaged inside a ZIP archive (Admin only)</summary>
    [HttpGet("backup/export")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> ExportTenantBackup(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return NotFound(new ApiResponse<object>(false, "ไม่พบข้อมูลองค์กร", null));

        var customers = await dbContext.Customers.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var vendors = await dbContext.Vendors.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var products = await dbContext.Products.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var warehouses = await dbContext.Warehouses.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var warehouseStocks = await dbContext.ProductWarehouseStocks.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var stockMovements = await dbContext.StockMovements.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var documents = await dbContext.DocumentHeaders.AsNoTracking().Include(d => d.Lines).Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var expenses = await dbContext.ExpenseRecords.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var purchaseOrders = await dbContext.PurchaseOrders.AsNoTracking().Include(p => p.Lines).Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var accounts = await dbContext.ChartOfAccounts.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var journals = await dbContext.JournalEntries.AsNoTracking().Include(j => j.Lines).Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var recurring = await dbContext.RecurringInvoices.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var bankTxs = await dbContext.BankStatementTransactions.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var periodLocks = await dbContext.AccountingPeriodLocks.AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(ct);

        var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "Admin";
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Action = "ExportTenantBackup",
            EntityName = "Tenant",
            EntityId = tenantId.ToString(),
            Timestamp = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync(ct);

        var jsonOpts = new JsonSerializerOptions
        {
            WriteIndented = true,
            ReferenceHandler = ReferenceHandler.IgnoreCycles,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddJsonEntry(archive, "manifest.json", new
            {
                exportedAtUtc = DateTime.UtcNow,
                exportedBy = username,
                tenantId,
                companyName = tenant.CompanyName,
                counts = new
                {
                    customers = customers.Count,
                    vendors = vendors.Count,
                    products = products.Count,
                    documents = documents.Count,
                    expenses = expenses.Count,
                    purchaseOrders = purchaseOrders.Count,
                    journals = journals.Count,
                    bankTransactions = bankTxs.Count
                }
            }, jsonOpts);
            AddJsonEntry(archive, "tenant.json", MapToDto(tenant), jsonOpts);
            AddJsonEntry(archive, "customers.json", customers, jsonOpts);
            AddJsonEntry(archive, "vendors.json", vendors, jsonOpts);
            AddJsonEntry(archive, "products.json", products, jsonOpts);
            AddJsonEntry(archive, "warehouses.json", warehouses, jsonOpts);
            AddJsonEntry(archive, "warehouse_stocks.json", warehouseStocks, jsonOpts);
            AddJsonEntry(archive, "stock_movements.json", stockMovements, jsonOpts);
            AddJsonEntry(archive, "documents.json", documents, jsonOpts);
            AddJsonEntry(archive, "expenses.json", expenses, jsonOpts);
            AddJsonEntry(archive, "purchase_orders.json", purchaseOrders, jsonOpts);
            AddJsonEntry(archive, "accounts.json", accounts, jsonOpts);
            AddJsonEntry(archive, "journals.json", journals, jsonOpts);
            AddJsonEntry(archive, "recurring_invoices.json", recurring, jsonOpts);
            AddJsonEntry(archive, "bank_transactions.json", bankTxs, jsonOpts);
            AddJsonEntry(archive, "period_locks.json", periodLocks, jsonOpts);
        }

        var safeTax = string.IsNullOrWhiteSpace(tenant.TaxId) ? tenant.Id.ToString("N")[..8] : tenant.TaxId;
        var fileName = $"SenicBackup_{safeTax}_{DateTime.UtcNow:yyyyMMdd_HHmm}.zip";
        return File(ms.ToArray(), "application/zip", fileName);
    }

    [HttpPost("logo")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxLogoSizeBytes)]
    public async Task<ActionResult<ApiResponse<TenantLogoUploadResultDto>>> UploadLogo(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ApiResponse<TenantLogoUploadResultDto>(false, "กรุณาเลือกไฟล์รูปภาพโลโก้", null));

        if (file.Length > MaxLogoSizeBytes)
            return BadRequest(new ApiResponse<TenantLogoUploadResultDto>(false, "ขนาดไฟล์โลโก้ต้องไม่เกิน 5 MB", null));

        var rawName = Path.GetFileName(file.FileName);
        var ext = Path.GetExtension(rawName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedLogoExtensions.Contains(ext))
            return BadRequest(new ApiResponse<TenantLogoUploadResultDto>(false, "รองรับเฉพาะไฟล์รูปภาพ PNG, JPG, JPEG หรือ WEBP เท่านั้น", null));

        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return NotFound(new ApiResponse<TenantLogoUploadResultDto>(false, "ไม่พบข้อมูลองค์กร", null));

        var safeFileName = $"logo-{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var objectKey = $"tenants/{tenantId}/{safeFileName}";
        var contentType = GetLogoContentType(ext);

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        if (!HasSupportedLogoHeader(bytes))
            return BadRequest(new ApiResponse<TenantLogoUploadResultDto>(false, "เนื้อหาไฟล์ไม่ตรงกับรูปแบบรูปภาพ PNG, JPG หรือ WEBP ที่รองรับ", null));

        var storedInObjectStorage = false;
        if (_storageService is not null)
        {
            try
            {
                await using var uploadStream = new MemoryStream(bytes);
                await _storageService.UploadFileAsync(uploadStream, safeFileName, contentType, LogoBucketName, objectKey, ct);
                storedInObjectStorage = true;
            }
            catch
            {
                // Fall back to local App_Data storage if MinIO/S3 is unavailable in development
            }
        }

        if (!storedInObjectStorage)
        {
            var logoDir = GetLocalLogoDirectory(tenantId);
            Directory.CreateDirectory(logoDir);
            await System.IO.File.WriteAllBytesAsync(Path.Combine(logoDir, safeFileName), bytes, ct);
        }

        var previousLogoUrl = tenant.LogoUrl;
        var logoUrl = $"/api/tenants/logo/{tenantId}/{safeFileName}";
        tenant.LogoUrl = logoUrl;
        tenant.UpdatedAt = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = User.GetUsername(),
            Action = "UploadTenantLogo",
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            OldValues = JsonSerializer.Serialize(new { LogoUrl = previousLogoUrl }),
            NewValues = JsonSerializer.Serialize(new { LogoUrl = logoUrl }),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<TenantLogoUploadResultDto>(
            true,
            "อัปโหลดโลโก้บริษัทสำเร็จ",
            new TenantLogoUploadResultDto(logoUrl, safeFileName)));
    }

    [HttpGet("logo/{tenantId:guid}/{fileName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLogo(Guid tenantId, string fileName, CancellationToken ct)
    {
        var safeFileName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safeFileName)
            || !string.Equals(safeFileName, fileName, StringComparison.Ordinal)
            || !AllowedLogoExtensions.Contains(Path.GetExtension(safeFileName)))
        {
            return BadRequest(new ApiResponse<object>(false, "ชื่อไฟล์โลโก้ไม่ถูกต้อง", null));
        }

        var contentType = GetLogoContentType(Path.GetExtension(safeFileName));

        if (_storageService is not null)
        {
            try
            {
                var stream = await _storageService.DownloadFileAsync(LogoBucketName, $"tenants/{tenantId}/{safeFileName}", ct);
                return File(stream, contentType);
            }
            catch
            {
                // Check local App_Data fallback
            }
        }

        var localPath = Path.Combine(GetLocalLogoDirectory(tenantId), safeFileName);
        if (!System.IO.File.Exists(localPath))
            return NotFound(new ApiResponse<object>(false, "ไม่พบไฟล์โลโก้บริษัท", null));

        var fileBytes = await System.IO.File.ReadAllBytesAsync(localPath, ct);
        return File(fileBytes, contentType);
    }

    private string GetLocalLogoDirectory(Guid tenantId)
    {
        var root = _environment?.ContentRootPath;
        if (string.IsNullOrWhiteSpace(root))
            root = Directory.GetCurrentDirectory();

        return Path.Combine(root, "App_Data", "logos", tenantId.ToString());
    }

    private static string GetLogoContentType(string ext) => ext.ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "image/jpeg"
    };

    private static bool HasSupportedLogoHeader(byte[] bytes)
    {
        if (bytes.Length < 4)
            return false;

        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            return true;

        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            return true;

        return bytes.Length >= 12
            && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P';
    }

    private static void AddJsonEntry(ZipArchive archive, string entryName, object data, JsonSerializerOptions options)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(JsonSerializer.Serialize(data, options));
    }

    private static TenantProfileDto MapToDto(Tenant tenant) => new(
        tenant.Id,
        tenant.CompanyName,
        tenant.TaxId,
        tenant.Address,
        tenant.Phone,
        tenant.Email,
        tenant.LogoUrl,
        tenant.BranchName,
        tenant.LineNotifyToken,
        tenant.LineDefaultTargetId,
        !string.IsNullOrWhiteSpace(tenant.LineChannelAccessToken),
        !string.IsNullOrWhiteSpace(tenant.LineChannelSecret));
}
