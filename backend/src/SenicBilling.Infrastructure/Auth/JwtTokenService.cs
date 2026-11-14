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
    public string GenerateToken(AppUser user, string tenantName, string? impersonatedBy = null)
    {
        var jwtSettings = configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey is not configured");
        var issuer = jwtSettings["Issuer"] ?? "SenicBillingNext";
        var audience = jwtSettings["Audience"] ?? "SenicBillingNextClient";
        var expiryMinutes = int.Parse(jwtSettings["ExpiryMinutes"] ?? "480"); // Default 8 hours

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new("id", user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new("username", user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("tenantId", user.TenantId.ToString()),
            new("tenantName", tenantName),
            new("displayName", user.DisplayName),
            new(ClaimTypes.Role, user.Role)
        };

        if (!string.IsNullOrWhiteSpace(impersonatedBy))
        {
            claims.Add(new Claim("impersonatedBy", impersonatedBy));
        }

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
