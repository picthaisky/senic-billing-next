namespace SenicBilling.Domain.Enums;

public enum PurchaseOrderStatus
{
    Draft = 0,
    Sent = 1,
    PartiallyReceived = 2,
    Received = 3,
    Cancelled = 9
}

public enum StockMovementType
{
    SaleOut = 1,
    SaleRestock = 2,
    PurchaseIn = 3,
    TransferOut = 4,
    TransferIn = 5,
    Adjustment = 6
}

public enum AccountType
{
    Asset = 1,
    Liability = 2,
    Equity = 3,
    Revenue = 4,
    Expense = 5
}

public enum JournalSourceType
{
    Manual = 0,
    SalesDocument = 1,
    Payment = 2,
    Expense = 3,
    PurchaseReceive = 4,
    Reversal = 5
}

