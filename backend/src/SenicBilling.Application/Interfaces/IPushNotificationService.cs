namespace SenicBilling.Application.Interfaces;

public interface IPushNotificationService
{
    Task SendNotificationAsync(Guid userId, string title, string message, string? url = null);
    Task SendNotificationToAllAsync(string title, string message, string? url = null);
}
