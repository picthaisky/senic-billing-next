using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;

namespace SenicBilling.Infrastructure.Services;

public class OmisePaymentService : IPaymentService
{
    private readonly ILogger<OmisePaymentService> _logger;
    private readonly string _publicKey;
    private readonly string _secretKey;
    private readonly HttpClient _httpClient;

    public OmisePaymentService(IConfiguration configuration, ILogger<OmisePaymentService> logger)
    {
        _logger = logger;
        _publicKey = configuration["Omise:PublicKey"] ?? string.Empty;
        _secretKey = configuration["Omise:SecretKey"] ?? string.Empty;
        
        _httpClient = new HttpClient();
        var authBytes = Encoding.ASCII.GetBytes($"{_secretKey}:");
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
    }

    public async Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "")
    {
        try
        {
            var amountInSubunits = (long)(amount * 100);

            // 1. Create Source via HTTP
            var sourceContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("amount", amountInSubunits.ToString()),
                new KeyValuePair<string, string>("currency", "THB"),
                new KeyValuePair<string, string>("type", "promptpay")
            });

            var sourceRes = await _httpClient.PostAsync("https://api.omise.co/sources", sourceContent);
            sourceRes.EnsureSuccessStatusCode();
            var sourceJson = await sourceRes.Content.ReadAsStringAsync();
            var sourceData = JsonSerializer.Deserialize<JsonElement>(sourceJson);
            var sourceId = sourceData.GetProperty("id").GetString();

            if (string.IsNullOrEmpty(sourceId))
            {
                throw new Exception("Failed to get Source ID from Omise");
            }

            // 2. Create Charge via HTTP
            var chargeContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("amount", amountInSubunits.ToString()),
                new KeyValuePair<string, string>("currency", "THB"),
                new KeyValuePair<string, string>("source", sourceId),
                new KeyValuePair<string, string>("return_uri", string.IsNullOrEmpty(returnUrl) ? "http://localhost:5173/payments/callback" : returnUrl),
                new KeyValuePair<string, string>("metadata[DocumentId]", referenceId)
            });

            var chargeRes = await _httpClient.PostAsync("https://api.omise.co/charges", chargeContent);
            chargeRes.EnsureSuccessStatusCode();
            var chargeJson = await chargeRes.Content.ReadAsStringAsync();
            var chargeData = JsonSerializer.Deserialize<JsonElement>(chargeJson);
            var chargeId = chargeData.GetProperty("id").GetString();

            var qrCodeUrl = chargeData.GetProperty("source").GetProperty("scannable_code").GetProperty("image").GetProperty("download_uri").GetString();

            return (chargeId ?? string.Empty, qrCodeUrl ?? string.Empty);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Omise PromptPay charge for Reference: {ReferenceId}", referenceId);
            throw;
        }
    }

    public async Task<bool> VerifyChargeAsync(string chargeId)
    {
        try
        {
            var res = await _httpClient.GetAsync($"https://api.omise.co/charges/{chargeId}");
            if (!res.IsSuccessStatusCode) return false;
            
            var json = await res.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<JsonElement>(json);
            return data.GetProperty("status").GetString() == "successful";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify Omise charge: {ChargeId}", chargeId);
            return false;
        }
    }
}
