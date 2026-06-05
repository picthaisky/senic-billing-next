using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;

namespace SenicBilling.Infrastructure.Data;

/// <summary>
/// EF Core 10 DbContext for Senic Billing Next.
/// Configured with Fluent API for precise control over relationships, indexes, and constraints.
/// </summary>
public class SenicBillingDbContext(DbContextOptions<SenicBillingDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<DocumentHeader> DocumentHeaders => Set<DocumentHeader>();
    public DbSet<DocumentLine> DocumentLines => Set<DocumentLine>();
    public DbSet<DocumentNumberSequence> DocumentNumberSequences => Set<DocumentNumberSequence>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<RecurringInvoice> RecurringInvoices => Set<RecurringInvoice>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ──────────────────────────────────────────────
        // Tenant Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CompanyName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TaxId).HasMaxLength(13);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.LogoUrl).HasMaxLength(500);
            entity.Property(e => e.BranchName).HasMaxLength(100);

            entity.HasIndex(e => e.TaxId).IsUnique().HasFilter("\"TaxId\" IS NOT NULL");
        });

        // ──────────────────────────────────────────────
        // Customer Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TaxId).HasMaxLength(13);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.ContactPerson).HasMaxLength(200);
            entity.Property(e => e.Notes).HasMaxLength(1000);

            // Tenant relationship (One-to-Many)
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Customers)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index for fast search by name within a tenant
            entity.HasIndex(e => new { e.TenantId, e.Name });
            entity.HasIndex(e => new { e.TenantId, e.TaxId });
        });

        // ──────────────────────────────────────────────
        // Product Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Sku).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Unit).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Category).HasMaxLength(100);

            // Precise currency fields
            entity.Property(e => e.UnitPrice).HasPrecision(18, 4);
            entity.Property(e => e.StockQuantity).HasPrecision(18, 4);

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Products)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.Sku }).IsUnique()
                .HasFilter("\"Sku\" IS NOT NULL");
            entity.HasIndex(e => new { e.TenantId, e.Name });
        });

        // ──────────────────────────────────────────────
        // DocumentHeader Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<DocumentHeader>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DocumentNumber).IsRequired().HasMaxLength(30);
            entity.Property(e => e.CustomerName).HasMaxLength(200);
            entity.Property(e => e.CustomerAddress).HasMaxLength(500);
            entity.Property(e => e.CustomerTaxId).HasMaxLength(13);
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.Property(e => e.CancellationReason).HasMaxLength(500);
            entity.Property(e => e.DeliveryStatus).HasMaxLength(50);
            entity.Property(e => e.CreatedBy).HasMaxLength(100);

            // Precise currency fields (18,4 for exact Thai Baht calculations)
            entity.Property(e => e.Subtotal).HasPrecision(18, 4);
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 4);
            entity.Property(e => e.TotalBeforeVat).HasPrecision(18, 4);
            entity.Property(e => e.VatAmount).HasPrecision(18, 4);
            entity.Property(e => e.GrandTotal).HasPrecision(18, 4);
            entity.Property(e => e.VatRate).HasPrecision(5, 2);
            entity.Property(e => e.WhtRate).HasPrecision(5, 2);
            entity.Property(e => e.WhtAmount).HasPrecision(18, 4);

            // Enum conversions stored as string for readability
            entity.Property(e => e.DocumentType).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.VatMode).HasConversion<string>().HasMaxLength(20);

            // Relationships
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Documents)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Customer)
                .WithMany(c => c.Documents)
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.ReferenceDocument)
                .WithMany()
                .HasForeignKey(e => e.ReferenceDocumentId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes for common queries
            entity.HasIndex(e => new { e.TenantId, e.DocumentType, e.DocumentDate });
            entity.HasIndex(e => new { e.TenantId, e.DocumentNumber }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.Status });
            entity.HasIndex(e => new { e.TenantId, e.ConvertedFromDocumentId })
                .HasFilter("\"ConvertedFromDocumentId\" IS NOT NULL");
        });

        // ──────────────────────────────────────────────
        // DocumentLine Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<DocumentLine>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Unit).IsRequired().HasMaxLength(50);

            // Precise currency fields
            entity.Property(e => e.Quantity).HasPrecision(18, 4);
            entity.Property(e => e.UnitPrice).HasPrecision(18, 4);
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 4);
            entity.Property(e => e.LineTotal).HasPrecision(18, 4);

            entity.HasOne(e => e.DocumentHeader)
                .WithMany(d => d.Lines)
                .HasForeignKey(e => e.DocumentHeaderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.DocumentHeaderId, e.SortOrder });
        });

        // ──────────────────────────────────────────────
        // Attachment Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<Attachment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FileName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.OriginalFileName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.ContentType).HasMaxLength(100);
            entity.Property(e => e.ObjectKey).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.UploadedBy).HasMaxLength(100);

            entity.HasOne(e => e.Document)
                .WithMany(d => d.Attachments)
                .HasForeignKey(e => e.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ──────────────────────────────────────────────
        // DocumentNumberSequence Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<DocumentNumberSequence>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.YearMonth).IsRequired().HasMaxLength(6);
            entity.Property(e => e.DocumentType).HasConversion<string>().HasMaxLength(20);

            // CRITICAL: Concurrency token to prevent race conditions
            entity.Property(e => e.RowVersion).IsRowVersion();

            // CRITICAL: Unique composite index ensures one sequence per tenant/type/month
            entity.HasIndex(e => new { e.TenantId, e.DocumentType, e.YearMonth })
                .IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.NumberSequences)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ──────────────────────────────────────────────
        // AppUser Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Role).IsRequired().HasMaxLength(50);

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            // Unique username per tenant
            entity.HasIndex(e => new { e.TenantId, e.Username }).IsUnique();
        });

        // ──────────────────────────────────────────────
        // PushSubscription Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Endpoint).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.P256dh).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Auth).IsRequired().HasMaxLength(200);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Avoid duplicate endpoints
            entity.HasIndex(e => e.Endpoint).IsUnique();
        });

        // ──────────────────────────────────────────────
        // PaymentTransaction Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<PaymentTransaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Amount).HasColumnType("decimal(18,4)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Document)
                .WithMany()
                .HasForeignKey(e => e.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ──────────────────────────────────────────────
        // AuditLog Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).HasMaxLength(100);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.EntityName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityId).IsRequired().HasMaxLength(100);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.EntityName, e.EntityId });
            entity.HasIndex(e => new { e.TenantId, e.Timestamp });
        });

        // ──────────────────────────────────────────────
        // Permission Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ──────────────────────────────────────────────
        // RolePermission Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RoleName).IsRequired().HasMaxLength(50);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Permission)
                .WithMany()
                .HasForeignKey(e => e.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.TenantId, e.RoleName, e.PermissionId }).IsUnique();
        });

        // ──────────────────────────────────────────────
        // RecurringInvoice Configuration
        // ──────────────────────────────────────────────
        modelBuilder.Entity<RecurringInvoice>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Frequency).IsRequired().HasMaxLength(50);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.SourceDocument)
                .WithMany()
                .HasForeignKey(e => e.SourceDocumentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.TenantId, e.IsActive, e.NextRunDate });
        });

        // ──────────────────────────────────────────────
        // Data Seeding (Default Admin & Tenant)
        // ──────────────────────────────────────────────
        var defaultTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        
        modelBuilder.Entity<Tenant>().HasData(new Tenant
        {
            Id = defaultTenantId,
            CompanyName = "Senic Corporation",
            TaxId = "0105560000000",
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });

        modelBuilder.Entity<AppUser>().HasData(new AppUser
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            TenantId = defaultTenantId,
            Username = "admin",
            DisplayName = "System Admin",
            Email = "admin@senic.local",
            // SHA256 base64 for "admin123" -> JAvlGPq9JyTdtvBO6x2llnRI1+gxwIyPqCKAn3THIKk=
            PasswordHash = "JAvlGPq9JyTdtvBO6x2llnRI1+gxwIyPqCKAn3THIKk=",
            Role = "Admin",
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}
