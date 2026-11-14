using Minio;
using Minio.DataModel.Args;
using SenicBilling.Application.Interfaces;

namespace SenicBilling.Infrastructure.Storage;

public class MinioStorageService : IStorageService
{
    private readonly IMinioClient _minioClient;

    public MinioStorageService(IMinioClient minioClient)
    {
        _minioClient = minioClient;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string bucketName, string objectKey, CancellationToken ct = default)
    {
        // Ensure bucket exists
        var beArgs = new BucketExistsArgs().WithBucket(bucketName);
        var found = await _minioClient.BucketExistsAsync(beArgs, ct);
        if (!found)
        {
            var mbArgs = new MakeBucketArgs().WithBucket(bucketName);
            await _minioClient.MakeBucketAsync(mbArgs, ct);
        }

        var putObjectArgs = new PutObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType);

        var putResponse = await _minioClient.PutObjectAsync(putObjectArgs, ct);
        if (putResponse is null || (putResponse.Size <= 0 && string.IsNullOrWhiteSpace(putResponse.Etag)))
        {
            throw new IOException($"Failed to persist object '{objectKey}' in bucket '{bucketName}'.");
        }

        return objectKey;
    }

    public async Task<Stream> DownloadFileAsync(string bucketName, string objectKey, CancellationToken ct = default)
    {
        var memoryStream = new MemoryStream();
        var getObjectArgs = new GetObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey)
            .WithCallbackStream((stream) =>
            {
                stream.CopyTo(memoryStream);
            });

        var stat = await _minioClient.GetObjectAsync(getObjectArgs, ct);
        if (stat is null || string.IsNullOrWhiteSpace(stat.ObjectName) || memoryStream.Length == 0)
        {
            memoryStream.Dispose();
            throw new FileNotFoundException($"Object '{objectKey}' was not found or was empty in bucket '{bucketName}'.");
        }

        memoryStream.Position = 0;
        return memoryStream;
    }

    public async Task DeleteFileAsync(string bucketName, string objectKey, CancellationToken ct = default)
    {
        var removeObjectArgs = new RemoveObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey);

        await _minioClient.RemoveObjectAsync(removeObjectArgs, ct);
    }

    public async Task<string> GetPresignedUrlAsync(string bucketName, string objectKey, int expirySeconds = 3600)
    {
        var args = new PresignedGetObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey)
            .WithExpiry(expirySeconds);
            
        return await _minioClient.PresignedGetObjectAsync(args);
    }
}
