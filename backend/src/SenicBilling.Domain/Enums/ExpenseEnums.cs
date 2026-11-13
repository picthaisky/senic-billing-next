namespace SenicBilling.Domain.Enums;

/// <summary>หมวดหมู่ค่าใช้จ่าย</summary>
public enum ExpenseCategory
{
    /// <summary>ต้นทุนสินค้า / วัตถุดิบ</summary>
    CostOfGoods = 1,
    /// <summary>ค่าเช่าและสาธารณูปโภค</summary>
    RentAndUtilities = 2,
    /// <summary>ค่าบริการวิชาชีพ / จ้างทำของ</summary>
    ProfessionalService = 3,
    /// <summary>ค่าโฆษณา / การตลาด</summary>
    Marketing = 4,
    /// <summary>อุปกรณ์สำนักงาน</summary>
    OfficeSupplies = 5,
    /// <summary>ค่าขนส่ง / เดินทาง</summary>
    Transportation = 6,
    /// <summary>อื่น ๆ</summary>
    Other = 99
}

/// <summary>ประเภทแบบยื่นภาษีหัก ณ ที่จ่าย</summary>
public enum PndType
{
    None = 0,
    /// <summary>ภ.ง.ด.3 — ผู้ถูกหักเป็นบุคคลธรรมดา</summary>
    PND3 = 3,
    /// <summary>ภ.ง.ด.53 — ผู้ถูกหักเป็นนิติบุคคล</summary>
    PND53 = 53
}

/// <summary>สถานะใบสำคัญจ่าย</summary>
public enum ExpenseStatus
{
    Draft = 0,
    Approved = 1,
    Paid = 2,
    Cancelled = 9
}

