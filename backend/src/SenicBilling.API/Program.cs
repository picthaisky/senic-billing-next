using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SenicBilling.Infrastructure.Services;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// ──────────────────────────────────────────────
// Database (PostgreSQL via EF Core 10)
// ──────────────────────────────────────────────
builder.Services.AddDbContext<SenicBillingDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection") ??
        "Host=localhost;Port=5432;Database=senic_billing;Username=postgres;Password=postgres",
        npgsqlOptions => npgsqlOptions.MigrationsAssembly("SenicBilling.Infrastructure")
    ));

// ──────────────────────────────────────────────
// Authentication (JWT)
// ──────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? "SenicBillingNextSuperSecretKey2026!@#$%^&*()_+1234567890";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"] ?? "SenicBillingNext",
            ValidAudience = jwtSettings["Audience"] ?? "SenicBillingNextClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ──────────────────────────────────────────────
// Services (DI Registration)
// ──────────────────────────────────────────────
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IDocumentNumberGeneratorService, DocumentNumberGeneratorService>();

// ──────────────────────────────────────────────
// CORS (for React frontend)
// ──────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ──────────────────────────────────────────────
// Controllers & JSON
// ──────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// ──────────────────────────────────────────────
// Swagger / OpenAPI
// ──────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ──────────────────────────────────────────────
// Middleware Pipeline
// ──────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
    dbContext.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
