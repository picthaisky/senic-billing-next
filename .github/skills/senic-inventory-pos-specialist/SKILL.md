---
name: senic-inventory-pos-specialist
description: 'Invoke Senic Inventory & Barcode POS Specialist for stock management, SKU/barcode separation, automated stock deduction, restocking on cancel/update, and POS barcode scanning in InvoiceForm.'
argument-hint: 'Inventory, stock deduction/restock, or barcode scanning task'
---

# Senic Inventory & Barcode POS Specialist

## When to Use

- Modifying `Product` entity, `ProductsController`, or `ProductsPage.tsx` (SKU, Barcode, `StockQuantity`).
- Implementing or fixing stock deduction (`DeductStockAsync`) and restocking on document creation, update, cancellation, or conversion (`DocumentControllerBase`, `TaxInvoiceController`).
- Enhancing barcode scanning or product lookup in `InvoiceForm.tsx`.

## Procedure

1. Read `.github/agents/senic-inventory-pos-specialist.agent.md` and `.ai-agents/skills/inventory-stock-barcode-playbook.md`.
2. Verify that `StockQuantity` uses `decimal(18,4)` and `null` represents non-stock/service items.
3. Ensure stock is deducted for `CashBill`, `DeliveryNote`, and `TaxInvoice`, and never double-deducted when converting `DeliveryNote` -> `TaxInvoice`.
4. Ensure `ProductsPage.tsx` sends both `barcode` and `stockQuantity` in create/update payloads.
5. Validate with `dotnet build` and `npm run build`.

