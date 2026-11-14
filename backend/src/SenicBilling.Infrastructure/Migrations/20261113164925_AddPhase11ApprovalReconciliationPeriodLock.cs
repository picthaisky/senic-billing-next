using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicBilling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPhase11ApprovalReconciliationPeriodLock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "Products",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "DocumentHeaders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByName",
                table: "DocumentHeaders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerApprovalComment",
                table: "DocumentHeaders",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerApprovalStatus",
                table: "DocumentHeaders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CustomerSignatureText",
                table: "DocumentHeaders",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastReminderSentAt",
                table: "DocumentHeaders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountingPeriodLocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    IsLocked = table.Column<bool>(type: "boolean", nullable: false),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LockedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UnlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UnlockedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountingPeriodLocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountingPeriodLocks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BankStatementTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BankName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ReferenceNo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CounterpartyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DepositAmount = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    WithdrawalAmount = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    MatchStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MatchedDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedDocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MatchedExpenseId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedExpenseNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MatchedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankStatementTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankStatementTransactions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountingPeriodLocks_TenantId_Year_Month",
                table: "AccountingPeriodLocks",
                columns: new[] { "TenantId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementTransactions_TenantId_MatchStatus",
                table: "BankStatementTransactions",
                columns: new[] { "TenantId", "MatchStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementTransactions_TenantId_TransactionDate",
                table: "BankStatementTransactions",
                columns: new[] { "TenantId", "TransactionDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountingPeriodLocks");

            migrationBuilder.DropTable(
                name: "BankStatementTransactions");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "ApprovedByName",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "CustomerApprovalComment",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "CustomerApprovalStatus",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "CustomerSignatureText",
                table: "DocumentHeaders");

            migrationBuilder.DropColumn(
                name: "LastReminderSentAt",
                table: "DocumentHeaders");
        }
    }
}
