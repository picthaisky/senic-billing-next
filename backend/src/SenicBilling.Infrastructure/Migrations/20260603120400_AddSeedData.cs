using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Tenants",
                columns: new[] { "Id", "Address", "BranchName", "CompanyName", "CreatedAt", "Email", "IsActive", "LogoUrl", "Phone", "TaxId", "UpdatedAt" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000001"), null, null, "Senic Corporation", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, null, null, "0105560000000", null });

            migrationBuilder.InsertData(
                table: "AppUsers",
                columns: new[] { "Id", "CreatedAt", "DisplayName", "Email", "IsActive", "LastLoginAt", "PasswordHash", "Role", "TenantId", "Username" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000002"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "System Admin", "admin@senic.local", true, null, "JAvlGPq9JyTdtvBO6x2llnRI1+gxwIyPqCKAn3THIKk=", "Admin", new Guid("00000000-0000-0000-0000-000000000001"), "admin" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AppUsers",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "Tenants",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"));
        }
    }
}
