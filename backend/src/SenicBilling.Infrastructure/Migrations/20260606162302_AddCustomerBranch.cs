using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerBranch",
                table: "DocumentHeaders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Branch",
                table: "Customers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerBranch",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "Branch",
                table: "Customers");
        }
    }
}
