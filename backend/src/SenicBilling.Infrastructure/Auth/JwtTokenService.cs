using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SenicBilling.Domain.Entities;

namespace SenicBilling.Infrastructure.Auth;

/// <summary>
/// Generates and validates JWT tokens for authentication.
/// Tokens include TenantId and Role claims for row-level data isolation and RBAC.
/// </summary>
public class JwtTokenService(IConfiguration configuration)
{
    public string GenerateToken(AppUser user, string tenantName)
    {
        var jwtSettings = configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey is not configured");
        var issuer = jwtSettings["Issuer"] ?? "SenicBillingNext";
        var audience = jwtSettings["Audience"] ?? "SenicBillingNextClient";
        var expiryMinutes = int.Parse(jwtSettings["ExpiryMinutes"] ?? "480"); // Default 8 hours

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("tenantId", user.TenantId.ToString()),
            new Claim("tenantName", tenantName),
            new Claim("displayName", user.DisplayName),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    }
}
