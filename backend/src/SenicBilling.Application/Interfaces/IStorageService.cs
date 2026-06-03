namespace SenicBilling.Application.Interfaces;

public interface IStorageService
{
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string bucketName, string objectKey, CancellationToken ct = default);
    Task<Stream> DownloadFileAsync(string bucketName, string objectKey, CancellationToken ct = default);
    Task DeleteFileAsync(string bucketName, string objectKey, CancellationToken ct = default);
    Task<string> GetPresignedUrlAsync(string bucketName, string objectKey, int expirySeconds = 3600);
}
