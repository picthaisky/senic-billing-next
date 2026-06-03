namespace SenicBilling.Domain.Entities;

public class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // The user who owns this subscription
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    
    // The endpoint provided by the browser push service
    public string Endpoint { get; set; } = string.Empty;
    
    // P256dh public key
    public string P256dh { get; set; } = string.Empty;
    
    // Authentication secret
    public string Auth { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
