using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttachmentsController(SenicBillingDbContext dbContext, IStorageService storageService) : ControllerBase
{
    private const string BucketName = "senic-billing";
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".xls", ".csv", ".txt"
    };

    [HttpPost("upload/{documentId}")]
    public async Task<ActionResult<ApiResponse<object>>> UploadFile(Guid documentId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<object>(false, "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด", null));
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return BadRequest(new ApiResponse<object>(false, "ขนาดไฟล์ต้องไม่เกิน 10 MB", null));
        }

        var safeFileName = Path.GetFileName(file.FileName);
        var ext = Path.GetExtension(safeFileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
        {
            return BadRequest(new ApiResponse<object>(false, "ประเภทไฟล์ไม่ได้รับอนุญาต (รองรับ PDF, รูปภาพ, Excel, CSV, TXT)", null));
        }

        var tenantId = User.GetTenantId();
        var document = await dbContext.DocumentHeaders
            .FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId, ct);

        if (document is null)
        {
            return NotFound(new ApiResponse<object>(false, "ไม่พบเอกสาร", null));
        }

        var objectKey = $"{tenantId}/{documentId}/{Guid.NewGuid()}_{safeFileName}";
        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;

        using var stream = file.OpenReadStream();
        await storageService.UploadFileAsync(stream, safeFileName, contentType, BucketName, objectKey, ct);

        var attachment = new Attachment
        {
            DocumentId = documentId,
            FileName = safeFileName,
            OriginalFileName = safeFileName,
            ContentType = contentType,
            FileSize = file.Length,
            ObjectKey = objectKey,
            UploadedBy = User.GetUsername()
        };

        dbContext.Attachments.Add(attachment);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "อัปโหลดสำเร็จ", new
        {
            attachment.Id,
            attachment.FileName,
            attachment.FileSize,
            attachment.UploadedAt
        }));
    }

    [HttpGet("download/{id}")]
    public async Task<IActionResult> DownloadFile(Guid id, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        var attachment = await dbContext.Attachments
            .Include(a => a.Document)
            .FirstOrDefaultAsync(a => a.Id == id && a.Document != null && a.Document.TenantId == tenantId, ct);

        if (attachment is null)
        {
            return NotFound(new ApiResponse<object>(false, "ไม่พบไฟล์แนบ", null));
        }

        var stream = await storageService.DownloadFileAsync(BucketName, attachment.ObjectKey, ct);
        return File(stream, attachment.ContentType, attachment.FileName);
    }
}
