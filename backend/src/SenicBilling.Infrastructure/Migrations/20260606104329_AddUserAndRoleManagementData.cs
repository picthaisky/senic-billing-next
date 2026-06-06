using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAndRoleManagementData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Permissions",
                columns: new[] { "Id", "Category", "Description", "Name" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000001"), "Documents", "ดูเอกสาร", "Documents.View" },
                    { new Guid("10000000-0000-0000-0000-000000000002"), "Documents", "สร้างเอกสาร", "Documents.Create" },
                    { new Guid("10000000-0000-0000-0000-000000000003"), "Documents", "แก้ไขเอกสาร", "Documents.Edit" },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "Documents", "ลบเอกสาร", "Documents.Delete" },
                    { new Guid("20000000-0000-0000-0000-000000000001"), "Customers", "จัดการลูกค้า", "Customers.Manage" },
                    { new Guid("30000000-0000-0000-0000-000000000001"), "Products", "จัดการสินค้า/บริการ", "Products.Manage" },
                    { new Guid("40000000-0000-0000-0000-000000000001"), "Settings", "ตั้งค่าระบบ", "Settings.Manage" },
                    { new Guid("50000000-0000-0000-0000-000000000001"), "Users", "จัดการผู้ใช้งานและสิทธิ์", "Users.Manage" },
                    { new Guid("60000000-0000-0000-0000-000000000001"), "Reports", "ดูรายงาน", "Reports.View" }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "Id", "PermissionId", "RoleName", "TenantId" },
                values: new object[,]
                {
                    { new Guid("70000000-0000-0000-0000-000000000001"), new Guid("10000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000002"), new Guid("10000000-0000-0000-0000-000000000002"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000003"), new Guid("10000000-0000-0000-0000-000000000003"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000004"), new Guid("10000000-0000-0000-0000-000000000004"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000005"), new Guid("20000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000006"), new Guid("30000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000007"), new Guid("40000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000008"), new Guid("50000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") },
                    { new Guid("70000000-0000-0000-0000-000000000009"), new Guid("60000000-0000-0000-0000-000000000001"), "Admin", new Guid("00000000-0000-0000-0000-000000000001") }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000003"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000004"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000005"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000006"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000007"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000008"));

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumn: "Id",
                keyValue: new Guid("70000000-0000-0000-0000-000000000009"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000003"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000004"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("20000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("30000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("50000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: new Guid("60000000-0000-0000-0000-000000000001"));
        }
    }
}
