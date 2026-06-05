namespace SenicBilling.Application.Interfaces;

public interface IAIAssistantService
{
    Task<string> ChatAsync(string prompt, string context, CancellationToken ct = default);
}
