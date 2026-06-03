using Microsoft.Extensions.Diagnostics.HealthChecks;
using Minio;
using Minio.DataModel.Args;

namespace SenicBilling.Infrastructure.HealthChecks;

public class MinioHealthCheck : IHealthCheck
{
    private readonly IMinioClient _minioClient;

    public MinioHealthCheck(IMinioClient minioClient)
    {
        _minioClient = minioClient;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Perform a lightweight operation to check if MinIO is responsive
            var response = await _minioClient.ListBucketsAsync(cancellationToken);
            
            if (response != null)
            {
                return HealthCheckResult.Healthy("MinIO is responding and accessible.");
            }
            
            return HealthCheckResult.Degraded("MinIO responded but returned null buckets list.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Failed to connect or authenticate with MinIO.", ex);
        }
    }
}
