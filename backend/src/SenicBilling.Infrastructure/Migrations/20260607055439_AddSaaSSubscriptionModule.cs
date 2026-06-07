using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSaaSSubscriptionModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CurrentPlanId",
                table: "Tenants",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionStatus",
                table: "Tenants",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubscriptionValidUntil",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BillingInvoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PaymentGatewayRef = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingInvoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingInvoices_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    YearlyPrice = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    MaxUsers = table.Column<int>(type: "integer", nullable: false),
                    MaxDocumentsPerMonth = table.Column<int>(type: "integer", nullable: false),
                    Features = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantUsageStats",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    YearMonth = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DocumentsCreated = table.Column<int>(type: "integer", nullable: false),
                    StorageUsedBytes = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantUsageStats", x => new { x.TenantId, x.YearMonth });
                    table.ForeignKey(
                        name: "FK_TenantUsageStats_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingCycle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantSubscriptions_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantSubscriptions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "Tenants",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                columns: new[] { "CurrentPlanId", "SubscriptionStatus", "SubscriptionValidUntil" },
                values: new object[] { null, "Trial", null });

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_CurrentPlanId",
                table: "Tenants",
                column: "CurrentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingInvoices_TenantId",
                table: "BillingInvoices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptions_PlanId",
                table: "TenantSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptions_TenantId",
                table: "TenantSubscriptions",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_SubscriptionPlans_CurrentPlanId",
                table: "Tenants",
                column: "CurrentPlanId",
                principalTable: "SubscriptionPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_SubscriptionPlans_CurrentPlanId",
                table: "Tenants");

            migrationBuilder.DropTable(
                name: "BillingInvoices");

            migrationBuilder.DropTable(
                name: "TenantSubscriptions");

            migrationBuilder.DropTable(
                name: "TenantUsageStats");

            migrationBuilder.DropTable(
                name: "SubscriptionPlans");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_CurrentPlanId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CurrentPlanId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionStatus",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionValidUntil",
                table: "Tenants");
        }
    }
}
