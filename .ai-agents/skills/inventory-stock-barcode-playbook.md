# Playbook: Inventory, Stock Deduction & Barcode POS

## 1. Trigger & Scope
- **Trigger**: Any task modifying `Product`, `ProductsController`, `ProductsPage.tsx`, `InvoiceForm.tsx` barcode scanner, `DocumentControllerBase.DeductStockAsync`, or `TaxInvoiceController`.
- **Owner Agent**: `senic-inventory-pos-specialist` (under `senic-ledger` & `senic-sage`)

## 2. Core Invariants
1. **Service vs Stock Product**:
   - `Product.StockQuantity` is `decimal?` (`decimal(18,4)`).
   - If `StockQuantity == null`, the item is a **Service / Non-Stock item** — never deduct or restore stock.
   - If `StockQuantity != null`, track exact quantities on stock-affecting documents.
2. **Stock-Affecting Document Types**:
   - **Deduct Stock**: `CashBill` (`CSB`), `DeliveryNote` (`DLV`), `TaxInvoice` (`INV`).
   - **Do NOT Deduct Stock**: `Quotation` (`QUO`), `Receipt` (`RCP`).
   - **1-Click Conversion Rule**: Converting `Quotation` -> `TaxInvoice` or `DeliveryNote` deducts stock. Converting `DeliveryNote` -> `TaxInvoice` must **NOT** deduct stock a second time.
3. **Stock Restoration (Restock) on Update & Cancel**:
   - When a `CashBill`, `DeliveryNote`, or `TaxInvoice` is **Cancelled**, restore `StockQuantity += line.Quantity` for all lines referencing a stock-tracked `ProductId` (unless it was converted from a `DeliveryNote` that remains active).
   - When a document is **Updated**, restore the old lines' quantities before deducting the new lines' quantities.
4. **SKU vs Barcode**:
   - `Sku` (internal code) and `Barcode` (EAN/UPC/Code128) are stored separately.
   - `GET /api/products?search=...` searches across `Name`, `Sku`, and `Barcode`.
   - `ProductsPage.tsx` must pass `barcode: formData.barcode || null` and `stockQuantity: formData.stockQuantity ?? null` in `POST / PUT /api/products`.

## 3. Required Evidence & Validation
- Backend build: `cd backend; dotnet build SenicBilling.slnx`
- Frontend build: `cd frontend; npm run build`
- Verification scenario: Create product with `StockQuantity = 10`, `Barcode = "8850000111111"` -> Scan in `InvoiceForm` -> Issue `TaxInvoice` or `CashBill` (qty 2) -> Verify `StockQuantity == 8` -> Cancel document -> Verify `StockQuantity == 10`.

