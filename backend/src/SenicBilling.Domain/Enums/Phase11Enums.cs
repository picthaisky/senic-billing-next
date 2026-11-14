namespace SenicBilling.Domain.Enums;

/// <summary>สถานะการยืนยัน/อนุมัติเอกสารออนไลน์โดยลูกค้า</summary>
public enum CustomerApprovalStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

/// <summary>สถานะการกระทบยอดรายการเดินบัญชีธนาคาร</summary>
public enum BankMatchStatus
{
    Unmatched = 0,
    Suggested = 1,
    Matched = 2,
    Ignored = 3
}

