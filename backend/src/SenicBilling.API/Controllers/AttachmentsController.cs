using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    [HttpPost("upload/{documentId}")]
    public async Task<ActionResult<ApiResponse<object>>> UploadFile(Guid documentId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<object>(false, "No file uploaded", null));
        }

        var document = await dbContext.DocumentHeaders.FindAsync([documentId], ct);
        if (document is null)
        {
            return NotFound(new ApiResponse<object>(false, "ไม่พบเอกสาร", null));
        }

        var objectKey = $"{document.TenantId}/{documentId}/{Guid.NewGuid()}_{file.FileName}";

        using var stream = file.OpenReadStream();
        await storageService.UploadFileAsync(stream, file.FileName, file.ContentType, BucketName, objectKey, ct);

        var attachment = new Attachment
        {
            DocumentId = documentId,
            FileName = file.FileName,
            OriginalFileName = file.FileName,
            ContentType = file.ContentType,
            FileSize = file.Length,
            ObjectKey = objectKey,
            UploadedBy = User.FindFirst("username")?.Value ?? "system"
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
        var attachment = await dbContext.Attachments.FindAsync([id], ct);
        if (attachment is null)
        {
            return NotFound();
        }

        var stream = await storageService.DownloadFileAsync(BucketName, attachment.ObjectKey, ct);
        return File(stream, attachment.ContentType, attachment.FileName);
    }
}
