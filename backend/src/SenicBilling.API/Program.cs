using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SenicBilling.Infrastructure.Services;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Application.Interfaces;
using SenicBilling.Infrastructure.HealthChecks;
using SenicBilling.API.Hubs;
using SenicBilling.API.Services;
using Minio;

var builder = WebApplication.CreateBuilder(args);

// ──────────────────────────────────────────────
// Database (PostgreSQL via EF Core 10)
// ──────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<SenicBilling.Infrastructure.Data.Interceptors.AuditInterceptor>();

builder.Services.AddDbContext<SenicBillingDbContext>((sp, options) =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection") ??
        "Host=localhost;Port=5432;Database=senic_billing;Username=postgres;Password=postgres",
        npgsqlOptions => npgsqlOptions.MigrationsAssembly("SenicBilling.Infrastructure")
    );
    
    var interceptor = sp.GetRequiredService<SenicBilling.Infrastructure.Data.Interceptors.AuditInterceptor>();
    options.AddInterceptors(interceptor);
});

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
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationPolicyProvider, SenicBilling.Infrastructure.Auth.PermissionPolicyProvider>();
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, SenicBilling.Infrastructure.Auth.PermissionAuthorizationHandler>();

// ──────────────────────────────────────────────
// Services (DI Registration)
// ──────────────────────────────────────────────
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IDocumentNumberGeneratorService, DocumentNumberGeneratorService>();
builder.Services.AddScoped<IPushNotificationService, PushNotificationService>();
builder.Services.AddScoped<IPaymentService, OmisePaymentService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IAIAssistantService, GeminiAIAssistantService>();
builder.Services.AddScoped<DevelopmentDataSeeder>();

// ──────────────────────────────────────────────
// Background Jobs (Hosted Services)
// ──────────────────────────────────────────────
builder.Services.AddHostedService<SenicBilling.Infrastructure.BackgroundJobs.RecurringInvoiceWorker>();
builder.Services.AddHostedService<SenicBilling.Infrastructure.BackgroundJobs.OverdueMonitorWorker>();

// MinIO Storage
var minioEndpoint = builder.Configuration["Minio:Endpoint"] ?? "localhost:9000";
var minioAccessKey = builder.Configuration["Minio:AccessKey"] ?? "admin";
var minioSecretKey = builder.Configuration["Minio:SecretKey"] ?? "password123";

builder.Services.AddMinio(configureClient => configureClient
    .WithEndpoint(minioEndpoint)
    .WithCredentials(minioAccessKey, minioSecretKey)
    .Build());

builder.Services.AddScoped<SenicBilling.Application.Interfaces.IStorageService, SenicBilling.Infrastructure.Storage.MinioStorageService>();

// ──────────────────────────────────────────────
// Health Checks & Monitoring
// ──────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("DefaultConnection") ?? 
        "Host=localhost;Port=5432;Database=senic_billing;Username=postgres;Password=postgres",
        name: "Database")
    .AddCheck<MinioHealthCheck>("MinIO");

builder.Services.AddHostedService<SystemMonitorService>();

// ──────────────────────────────────────────────
// SignalR
// ──────────────────────────────────────────────
builder.Services.AddSignalR();

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
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
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

    if (app.Environment.IsDevelopment())
    {
        var seeder = scope.ServiceProvider.GetRequiredService<DevelopmentDataSeeder>();
        await seeder.SeedAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<SenicBillingHub>("/hubs/billing");

app.Run();
