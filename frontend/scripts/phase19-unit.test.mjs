import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('Phase 19: LineWebhookController and AIAssistantController enforce CreditNote netting, overdue filtering, and App:FrontendBaseUrl', () => {
  const lineWebhook = read('backend/src/SenicBilling.API/Controllers/LineWebhookController.cs');
  assert.match(lineWebhook, /t\.SubscriptionStatus != "Suspended"/);
  assert.match(lineWebhook, /d\.DocumentType == DocumentType\.CreditNote \? -d\.GrandTotal : d\.GrandTotal/);
  assert.match(lineWebhook, /configuration\["App:FrontendBaseUrl"\] \?\? configuration\["Frontend:BaseUrl"\]/);

  const aiCtrl = read('backend/src/SenicBilling.API/Controllers/AIAssistantController.cs');
  assert.match(aiCtrl, /&& d\.DocumentType != DocumentType\.DeliveryNote/);
  assert.match(aiCtrl, /&& d\.DocumentType != DocumentType\.CreditNote/);
  assert.match(aiCtrl, /&& d\.Status != DocumentStatus\.Draft/);
});

test('Phase 19: PaymentsController, RecurringInvoiceController, and Master Data controllers enforce domain validation guardrails', () => {
  const payCtrl = read('backend/src/SenicBilling.API/Controllers/PaymentsController.cs');
  assert.match(payCtrl, /if \(document\.Status == DocumentStatus\.Cancelled\)/);
  assert.match(payCtrl, /document\.DocumentType is DocumentType\.Quotation or DocumentType\.DeliveryNote or DocumentType\.CreditNote/);

  const recCtrl = read('backend/src/SenicBilling.API/Controllers/RecurringInvoiceController.cs');
  assert.match(recCtrl, /AllowedFrequencies = \["Daily", "Weekly", "Monthly", "Yearly"\]/);
  assert.match(recCtrl, /source\.Status == DocumentStatus\.Cancelled/);

  const custCtrl = read('backend/src/SenicBilling.API/Controllers/CustomersController.cs');
  assert.match(custCtrl, /IsValidOptionalTaxId/);

  const prodCtrl = read('backend/src/SenicBilling.API/Controllers/ProductsController.cs');
  assert.match(prodCtrl, /req\.UnitPrice < 0 \|\| req\.CostPrice < 0/);
});

test('Phase 19: InvoiceForm renders editable customerBranch and customerAddress inputs with TH/EN i18n keys', () => {
  const invoiceForm = read('frontend/src/components/forms/InvoiceForm.tsx');
  assert.match(invoiceForm, /invoiceForm\.customerBranchLabel/);
  assert.match(invoiceForm, /invoiceForm\.customerAddressLabel/);
  assert.match(invoiceForm, /setCustomerBranch\(e\.target\.value\)/);
  assert.match(invoiceForm, /setCustomerAddress\(e\.target\.value\)/);

  const resources = read('frontend/src/i18n/resources.ts');
  assert.match(resources, /customerBranchLabel:/);
  assert.match(resources, /customerAddressLabel:/);
});
