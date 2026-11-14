using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPhase21AuthResetAndSubscriptionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OmiseChargeId",
                table: "TenantSubscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "TenantSubscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetTokenExpiresAt",
                table: "AppUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetTokenHash",
                table: "AppUsers",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "AppUsers",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                columns: new[] { "PasswordResetTokenExpiresAt", "PasswordResetTokenHash" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OmiseChargeId",
                table: "TenantSubscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "TenantSubscriptions");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenExpiresAt",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenHash",
                table: "AppUsers");
        }
    }
}
