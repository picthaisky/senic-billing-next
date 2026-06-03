using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using SenicBilling.API.Hubs;

namespace SenicBilling.API.Services;

public class SystemMonitorService : BackgroundService
{
    private readonly HealthCheckService _healthCheckService;
    private readonly IHubContext<SenicBillingHub> _hubContext;
    private readonly ILogger<SystemMonitorService> _logger;

    public SystemMonitorService(
        HealthCheckService healthCheckService,
        IHubContext<SenicBillingHub> hubContext,
        ILogger<SystemMonitorService> logger)
    {
        _healthCheckService = healthCheckService;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("System Monitor Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Run all registered health checks
                var report = await _healthCheckService.CheckHealthAsync(stoppingToken);

                var statusData = new
                {
                    Status = report.Status.ToString(),
                    TotalDuration = report.TotalDuration.TotalMilliseconds,
                    Components = report.Entries.Select(e => new
                    {
                        Name = e.Key,
                        Status = e.Value.Status.ToString(),
                        Description = e.Value.Description,
                        Duration = e.Value.Duration.TotalMilliseconds
                    })
                };

                // Broadcast to all connected SignalR clients
                await _hubContext.Clients.All.SendAsync("ReceiveSystemStatus", statusData, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while executing system health checks.");
            }

            // Wait 15 seconds before the next check
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }

        _logger.LogInformation("System Monitor Service stopped.");
    }
}
