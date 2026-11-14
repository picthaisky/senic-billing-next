using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>ผังบัญชี (Chart of Accounts)</summary>
public class ChartOfAccount
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AccountType AccountType { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;

    public Tenant Tenant { get; set; } = null!;
}

/// <summary>สมุดรายวันทั่วไป (Journal Entry — JV-YYYYMM-XXXX)</summary>
public class JournalEntry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string JournalNumber { get; set; } = string.Empty;
    public DateTime EntryDate { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = string.Empty;
    public JournalSourceType SourceType { get; set; } = JournalSourceType.Manual;
    public Guid? SourceId { get; set; }
    public string? SourceNumber { get; set; }
    public bool IsPosted { get; set; } = true;
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public ICollection<JournalEntryLine> Lines { get; set; } = [];
}

public class JournalEntryLine
{
    public Guid Id { get; set; }
    public Guid JournalEntryId { get; set; }
    public Guid AccountId { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string? Memo { get; set; }

    public JournalEntry JournalEntry { get; set; } = null!;
    public ChartOfAccount Account { get; set; } = null!;
}

/// <summary>การปิดงวดบัญชีรายเดือน (Accounting Period Lock) ป้องกันการแก้ไข/ลงบัญชีย้อนหลังในงวดที่ปิดแล้ว</summary>
public class AccountingPeriodLock
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public bool IsLocked { get; set; } = true;
    public DateTime LockedAt { get; set; } = DateTime.UtcNow;
    public string? LockedBy { get; set; }
    public string? Notes { get; set; }
    public DateTime? UnlockedAt { get; set; }
    public string? UnlockedBy { get; set; }

    public Tenant Tenant { get; set; } = null!;
}

