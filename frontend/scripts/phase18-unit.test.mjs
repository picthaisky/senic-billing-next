import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('Phase 18: SharedDocumentController, DocumentControllerBase, and TaxInvoiceController enforce conversion quota, e-Tax XML, and stock deduplication', () => {
  const sharedCtrl = read('backend/src/SenicBilling.API/Controllers/SharedDocumentController.cs');
  assert.match(sharedCtrl, /\[HttpGet\("\{id:guid\}\/e-tax-xml"\)\]/);
  assert.match(sharedCtrl, /MaxDocumentsPerMonth > 0/);
  assert.match(sharedCtrl, /DocumentsCreated/);

  const docBase = read('backend/src/SenicBilling.API/Controllers/DocumentControllerBase.cs');
  assert.match(docBase, /ไม่สามารถออกใบลดหนี้\/เพิ่มหนี้ในงวดนี้ได้/);
  assert.match(docBase, /DocumentsCreated \+= 1/);

  const taxCtrl = read('backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs');
  assert.match(taxCtrl, /alreadyDeductedByDeliveryNote/);
  assert.match(taxCtrl, /d\.DocumentType == DocumentType\.DeliveryNote/);
});

test('Phase 18: TaxSummaryQuery, ReportsController, and DashboardController include CreditNote (-) and DebitNote (+) parity', () => {
  const taxQuery = read('backend/src/SenicBilling.API/Services/TaxSummaryQuery.cs');
  assert.match(taxQuery, /d\.DocumentType == DocumentType\.CreditNote/);
  assert.match(taxQuery, /d\.DocumentType == DocumentType\.DebitNote/);
  assert.match(taxQuery, /Sign = d\.DocumentType == DocumentType\.CreditNote \? -1m : 1m/);

  const reportsCtrl = read('backend/src/SenicBilling.API/Controllers/ReportsController.cs');
  assert.match(reportsCtrl, /DocumentType\.CreditNote/);
  assert.match(reportsCtrl, /DocumentType\.DebitNote/);
  assert.match(reportsCtrl, /ใบลดหนี้/);
  assert.match(reportsCtrl, /ใบเพิ่มหนี้/);

  const dashCtrl = read('backend/src/SenicBilling.API/Controllers/DashboardController.cs');
  assert.match(dashCtrl, /SignedTotal = d\.DocumentType == DocumentType\.CreditNote \? -d\.GrandTotal : d\.GrandTotal/);
});

test('Phase 18: Frontend DocumentsListPage, DocumentPrintView, and InvoiceForm support Credit/Debit Note e-Tax XML and API error messages', () => {
  const docsList = read('frontend/src/components/documents/DocumentsListPage.tsx');
  assert.match(docsList, /\/documents\/\$\{docId\}\/e-tax-xml/);
  assert.match(docsList, /\['taxinvoice', 'creditnote', 'debitnote'\]\.includes\(type \|\| ''\)/);

  const printView = read('frontend/src/pages/DocumentPrintView.tsx');
  assert.match(printView, /\/documents\/\$\{id\}\/e-tax-xml/);
  assert.match(printView, /\['TaxInvoice', 'CreditNote', 'DebitNote'\]\.includes\(rawDoc\?\.documentType \|\| ''\)/);

  const invoiceForm = read('frontend/src/components/forms/InvoiceForm.tsx');
  assert.match(invoiceForm, /getApiErrorMessage\(error, t\('invoiceForm\.saveError'\)\)/);
  assert.match(invoiceForm, /\['taxinvoice', 'creditnote', 'debitnote'\]\.includes\(documentType\)/);
});
