using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLineNotifyToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LineNotifyToken",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Tenants",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "LineNotifyToken",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LineNotifyToken",
                table: "Tenants");
        }
    }
}
