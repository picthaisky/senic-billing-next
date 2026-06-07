namespace SenicBilling.Domain.Entities;

public class SubscriptionPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    /// <summary>ชื่อแพ็กเกจ (เช่น Free, Basic, Pro)</summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>ราคาต่อเดือน</summary>
    public decimal MonthlyPrice { get; set; }
    
    /// <summary>ราคาต่อปี</summary>
    public decimal YearlyPrice { get; set; }
    
    /// <summary>จำนวนผู้ใช้สูงสุดที่สร้างได้ (-1 = ไม่จำกัด)</summary>
    public int MaxUsers { get; set; }
    
    /// <summary>จำนวนเอกสารสูงสุดที่สร้างได้ต่อเดือน (-1 = ไม่จำกัด)</summary>
    public int MaxDocumentsPerMonth { get; set; }
    
    /// <summary>ฟีเจอร์ย่อย (เก็บเป็น JSON string หรือ JSONB ใน PG)</summary>
    public string? Features { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
