using System.Security.Cryptography;
using System.Text;

namespace SenicBilling.Application.Services;

/// <summary>
/// Validates the X-Line-Signature header: Base64(HMAC-SHA256(channelSecret, rawBody)).
/// Uses constant-time comparison to avoid timing attacks.
/// </summary>
public static class LineSignatureVerifier
{
    public static string ComputeSignature(string channelSecret, byte[] body)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(channelSecret));
        return Convert.ToBase64String(hmac.ComputeHash(body));
    }

    public static bool IsValid(string? channelSecret, byte[] body, string? signature)
    {
        if (string.IsNullOrWhiteSpace(channelSecret) || string.IsNullOrWhiteSpace(signature)) return false;

        byte[] provided;
        try
        {
            provided = Convert.FromBase64String(signature.Trim());
        }
        catch (FormatException)
        {
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(channelSecret));
        var expected = hmac.ComputeHash(body);
        return CryptographicOperations.FixedTimeEquals(expected, provided);
    }
}

