import { Plus, Trash2, Save, Printer, RotateCcw, CreditCard, Search } from 'lucide-react';
import { useDocumentForm, type VatMode } from '../../hooks/useDocumentForm';
import { useCallback, useState, useEffect, useRef } from 'react';
import { apiClient } from '../../services/apiClient';
import { getDocumentTypeMeta } from '../../utils/documentTypeMeta';

import AttachmentUpload from './AttachmentUpload';
import PaymentModal from '../payments/PaymentModal';
import CustomerSelectModal, { Customer } from '../customers/CustomerSelectModal';

interface InvoiceFormProps {
  documentType: string;
  title: string;
  documentId?: string;
}

export default function InvoiceForm({ documentType, title, documentId: propDocumentId }: InvoiceFormProps) {
  const { lines, addLine, removeLine, updateLine, vatMode, setVatMode, discountAmount, setDiscountAmount, whtRate, setWhtRate, totals, resetForm, restoreState } = useDocumentForm(7);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerBranch, setCustomerBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [documentId] = useState(() => propDocumentId || crypto.randomUUID());
  const [attachments, setAttachments] = useState<any[]>([]);

  const draftKey = `senic_draft_${documentType}`;
  const isInitialMount = useRef(true);

  // Load draft on mount
  useEffect(() => {
    if (propDocumentId) {
      // Fetch document for editing
      apiClient.get(`/documents/${propDocumentId}`).then(res => {
        if (res.data?.success) {
          const doc = res.data.data;
          setCustomerId(doc.customerId || null);
          setCustomerName(doc.customerName || '');
          setCustomerTaxId(doc.customerTaxId || '');
          setCustomerAddress(doc.customerAddress || '');
          setCustomerBranch(doc.customerBranch || '');
          setNotes(doc.notes || '');
          restoreState({
            lines: doc.lines,
            vatMode: doc.vatMode,
            discountAmount: doc.discountAmount,
            whtRate: doc.whtRate
          });
        }
      }).catch(err => {
        console.error('Failed to load document for editing', err);
      });
      return;
    }

    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.customerId) setCustomerId(draft.customerId);
        if (draft.customerName) setCustomerName(draft.customerName);
        if (draft.customerTaxId) setCustomerTaxId(draft.customerTaxId);
        if (draft.customerAddress) setCustomerAddress(draft.customerAddress);
        if (draft.customerBranch) setCustomerBranch(draft.customerBranch);
        if (draft.notes) setNotes(draft.notes);
        restoreState(draft.formState);
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, [documentId, documentType, draftKey, restoreState]);

  // Save draft on change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const draft = {
      customerId,
      customerName,
      customerTaxId,
      customerAddress,
      customerBranch,
      notes,
      formState: { lines, vatMode, discountAmount, whtRate }
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [customerId, customerName, customerTaxId, customerAddress, customerBranch, notes, lines, vatMode, discountAmount, whtRate, draftKey]);

  const config = getDocumentTypeMeta(documentType);
  const accentClasses: Record<string, { bar: string; text: string }> = {
    receipt: { bar: 'bg-[var(--doc-receipt)]', text: 'text-[var(--doc-receipt)]' },
    cashbill: { bar: 'bg-[var(--doc-cashbill)]', text: 'text-[var(--doc-cashbill)]' },
    delivery: { bar: 'bg-[var(--doc-delivery)]', text: 'text-[var(--doc-delivery)]' },
    quotation: { bar: 'bg-[var(--doc-quotation)]', text: 'text-[var(--doc-quotation)]' },
    taxinvoice: { bar: 'bg-[var(--doc-taxinvoice)]', text: 'text-[var(--doc-taxinvoice)]' },
  };
  const accent = accentClasses[documentType] ?? { bar: 'bg-[var(--color-primary)]', text: 'text-[var(--color-primary)]' };
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [errors, setErrors] = useState<{ customerName?: string; customerTaxId?: string; lines?: string }>({});

  const clearError = (key: keyof typeof errors) =>
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validate = () => {
    const e: typeof errors = {};
    if (!customerName.trim()) e.customerName = 'กรุณากรอกชื่อลูกค้า / บริษัท';
    if (documentType === 'taxinvoice') {
      if (!customerTaxId.trim()) e.customerTaxId = 'ใบกำกับภาษีต้องระบุเลขประจำตัวผู้เสียภาษี';
      else if (!/^\d{13}$/.test(customerTaxId.trim())) e.customerTaxId = 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก';
    }
    const validLines = lines.filter(l => l.description.trim() !== '' && l.quantity > 0 && l.unitPrice > 0);
    if (validLines.length === 0) e.lines = 'กรุณาเพิ่มรายการที่มีชื่อ จำนวน และราคา อย่างน้อย 1 รายการ';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const formatNumber = useCallback((n: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, isLastLine: boolean) => {
    if (e.key === 'Enter' && isLastLine) {
      e.preventDefault();
      addLine();
    }
  }, [addLine]);

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setIsSaving(true);
      const mapDocType = (t: string) => {
        const map: Record<string, string> = {
          'receipt': 'Receipt',
          'cashbill': 'CashBill',
          'delivery': 'DeliveryNote',
          'quotation': 'Quotation',
          'taxinvoice': 'TaxInvoice'
        };
        return map[t] || t;
      };

      const payload = {
        documentType: mapDocType(documentType),
        documentDate: new Date().toISOString(),
        customerId,
        customerName,
        customerTaxId,
        customerAddress,
        customerBranch,
        notes,
        vatMode,
        vatRate: 7,
        discountAmount,
        whtRate,
        lines: lines
          .filter(l => l.description.trim() !== '')
          .map(({ id, ...rest }) => rest), // Strip frontend-only ID which breaks C# Guid parsing
        ...totals,
      };

      const getEndpoint = (t: string) => {
        switch(t) {
          case 'receipt': return '/receipts';
          case 'cashbill': return '/cashbills';
          case 'delivery': return '/deliveries';
          case 'quotation': return '/quotations';
          case 'taxinvoice': return '/tax-invoices';
          default: return '/documents';
        }
      };

      // API call to create or update document
      if (propDocumentId) {
        await apiClient.put(`${getEndpoint(documentType)}/${propDocumentId}`, payload);
        alert('อัปเดตเอกสารสำเร็จ');
      } else {
        await apiClient.post(getEndpoint(documentType), payload);      
        alert('บันทึกเอกสารสำเร็จ');
      }
      localStorage.removeItem(draftKey);
      resetForm();
      setCustomerId(null);
      setCustomerName('');
      setCustomerTaxId('');
      setCustomerAddress('');
      setCustomerBranch('');
      setNotes('');
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกเอกสาร');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="document-form-stack">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-12 rounded-full ${accent.bar}`} />
          <div>
            <h2 className="text-xl font-bold leading-tight text-[var(--color-text)]">
              {title}
            </h2>
            <p className="invoice-page-subtitle text-sm text-[var(--color-text-muted)]">
              เลขที่เอกสาร: <span className={`font-mono font-semibold ${accent.text}`}>
                {config.prefix}-{new Date().toISOString().slice(0, 7).replace('-', '')}-AUTO
              </span>
            </p>
          </div>
        </div>

        {/* Document actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={resetForm} className="btn btn-ghost" title="รีเซ็ตฟอร์ม" disabled={isSaving}>
            <RotateCcw size={15} /> ล้างข้อมูล
          </button>
          <button className="btn btn-secondary" onClick={() => window.open('/print/draft', '_blank')} disabled={isSaving}>
            <Printer size={15} /> พิมพ์
          </button>
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="btn btn-secondary border !border-[rgba(37,99,235,0.28)] bg-[var(--color-info-bg)] text-[var(--color-info)]"
            disabled={isSaving}
          >
            <CreditCard size={15} /> ชำระเงินออนไลน์
          </button>
          <button onClick={handleSave} className="btn btn-primary" disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
          </button>
        </div>
      </div>

      {/* ── Customer Info Card ── */}
      <div className="card form-section-card">
        <h3 className="invoice-section-title font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          ข้อมูลลูกค้า
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="invoice-field-label text-xs font-medium block text-[var(--color-text-muted)]">
              ชื่อลูกค้า / บริษัท <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className={`input-field pr-10 ${errors.customerName ? 'input-error' : ''}`}
                placeholder="พิมพ์เพื่อค้นหา..."
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); clearError('customerName'); }}
              />
              <button
                type="button"
                onClick={() => setCustomerModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] rounded-md transition-colors"
                title="ค้นหาลูกค้าจากฐานข้อมูล"
              >
                <Search size={18} />
              </button>
            </div>
            {errors.customerName && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.customerName}</p>}
          </div>
          {documentType === 'taxinvoice' && (
            <div className="space-y-1.5">
              <label className="invoice-field-label text-xs font-medium block text-[var(--color-text-muted)]">
                เลขประจำตัวผู้เสียภาษี (13 หลัก) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className={`input-field font-mono ${errors.customerTaxId ? 'input-error' : ''}`}
                placeholder="เลข 13 หลัก"
                maxLength={13}
                value={customerTaxId}
                onChange={(e) => { setCustomerTaxId(e.target.value.replace(/\D/g, '')); clearError('customerTaxId'); }}
              />
              {errors.customerTaxId && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.customerTaxId}</p>}
            </div>
          )}
          <div className={`${documentType === 'taxinvoice' ? 'md:col-span-2' : ''} space-y-1.5`}>
            <label className="invoice-field-label text-xs font-medium block text-[var(--color-text-muted)]">
              หมายเหตุ
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="หมายเหตุ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          <div className="md:col-span-2 p-5 md:p-6 border border-orange-200 bg-orange-50/70 rounded-xl mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-4 sm:gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold block text-orange-900 leading-normal">
                ออกเอกสารนี้ซ้ำอัตโนมัติ (Recurring)
              </label>
              <p className="text-xs text-orange-700 leading-normal">ตั้งเวลาให้ระบบสร้างเอกสารนี้ซ้ำใหม่อัตโนมัติตามรอบที่กำหนด</p>
            </div>
            <select
              className="input-field w-full sm:w-[250px] border-orange-300 bg-white"
              value={''} // Default off
              onChange={async (e) => {
                if (e.target.value) {
                  alert('จะสามารถตั้งค่า Recurring ได้หลังจากบันทึกเอกสารแล้ว (หรือไปที่หน้าตั้งค่า)');
                }
              }}
            >
              <option value="">ไม่ทำซ้ำ</option>
              <option value="weekly">ทุกสัปดาห์</option>
              <option value="monthly">ทุกเดือน</option>
              <option value="yearly">ทุกปี</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Document Lines (Items Table) ── */}
      <div className="card overflow-hidden">
        <div className="invoice-lines-head flex items-center justify-between border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            รายการสินค้า / บริการ
          </h3>
          <button onClick={() => { addLine(); clearError('lines'); }} className="btn btn-ghost text-xs">
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {errors.lines && (
          <p className="px-5 py-2 text-xs text-[var(--color-danger)] bg-[var(--color-danger-bg)]">{errors.lines}</p>
        )}

        {/* Desktop: full table (horizontal scroll fallback on narrow desktop) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th className="w-[48px] text-center">#</th>
                <th>รายละเอียด</th>
                <th className="w-[88px] text-right">จำนวน</th>
                <th className="w-[72px]">หน่วย</th>
                <th className="w-[120px] text-right">ราคา/หน่วย</th>
                <th className="w-[100px] text-right">ส่วนลด</th>
                <th className="w-[120px] text-right">รวม</th>
                <th className="w-[44px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} className="animate-fade-in">
                  <td className="text-center font-mono text-sm align-middle text-[var(--color-text-muted)]">
                    {idx + 1}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field invoice-input-compact !text-sm"
                      placeholder="ชื่อสินค้า / รายละเอียด"
                      value={line.description}
                      onChange={(e) => { updateLine(line.id, { description: e.target.value }); clearError('lines'); }}
                      onKeyDown={(e) => handleKeyDown(e, idx === lines.length - 1)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label="จำนวน"
                      className="input-field invoice-input-compact !text-sm text-right"
                      min={0}
                      step={1}
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label="หน่วย"
                      className="input-field invoice-input-compact !text-sm text-center"
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label="ราคาต่อหน่วย"
                      className="input-field invoice-input-compact !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.unitPrice || ''}
                      onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label="ส่วนลด"
                      className="input-field invoice-input-compact !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.discountAmount || ''}
                      onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="invoice-line-total-cell text-right font-semibold text-sm tabular-nums align-middle text-[var(--color-text)]">
                    {formatNumber(line.lineTotal)}
                  </td>
                  <td className="text-center align-middle">
                    <button
                      onClick={() => removeLine(line.id)}
                      className={`p-1.5 rounded-lg transition-colors hover:bg-red-50 ${lines.length === 1 ? 'text-[var(--color-text-muted)]' : 'text-[#dc2626]'}`}
                      disabled={lines.length === 1}
                      aria-label={`ลบรายการที่ ${idx + 1}`}
                      title={`ลบรายการที่ ${idx + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked card list (each line is an editable card) */}
        <div className="md:hidden flex flex-col gap-3 p-3">
          {lines.map((line, idx) => (
            <div
              key={line.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-solid)] p-3 animate-fade-in"
            >
              {/* Card header: index + remove */}
              <div className="invoice-mobile-line-head flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-muted)]">
                  รายการที่ {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  title={`ลบรายการที่ ${idx + 1}`}
                  className={`p-1.5 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-40 ${lines.length === 1 ? 'text-[var(--color-text-muted)]' : 'text-[#dc2626]'}`}
                  disabled={lines.length === 1}
                  aria-label={`ลบรายการที่ ${idx + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Description */}
              <label className="invoice-mobile-label block text-[11px] font-medium text-[var(--color-text-muted)]">
                รายละเอียด
              </label>
              <input
                type="text"
                className="input-field invoice-input-compact !text-sm invoice-mobile-desc-input"
                placeholder="ชื่อสินค้า / รายละเอียด"
                value={line.description}
                onChange={(e) => updateLine(line.id, { description: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, idx === lines.length - 1)}
              />

              {/* Numeric fields grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="invoice-mobile-label block text-[11px] font-medium text-[var(--color-text-muted)]">
                    จำนวน
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="จำนวน"
                    className="input-field invoice-input-compact !text-sm text-right"
                    min={0}
                    step={1}
                    value={line.quantity || ''}
                    onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="invoice-mobile-label block text-[11px] font-medium text-[var(--color-text-muted)]">
                    หน่วย
                  </label>
                  <input
                    type="text"
                    aria-label="หน่วย"
                    className="input-field invoice-input-compact !text-sm text-center"
                    value={line.unit}
                    onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="invoice-mobile-label block text-[11px] font-medium text-[var(--color-text-muted)]">
                    ราคา/หน่วย
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="ราคาต่อหน่วย"
                    className="input-field invoice-input-compact !text-sm text-right"
                    min={0}
                    step={0.01}
                    value={line.unitPrice || ''}
                    onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="invoice-mobile-label block text-[11px] font-medium text-[var(--color-text-muted)]">
                    ส่วนลด
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="ส่วนลด"
                    className="input-field invoice-input-compact !text-sm text-right"
                    min={0}
                    step={0.01}
                    value={line.discountAmount || ''}
                    onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Line total */}
              <div className="invoice-mobile-line-total flex items-center justify-between border-t border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  รวม
                </span>
                <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                  {formatNumber(line.lineTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Attachments ── */}
      <AttachmentUpload
        documentId={documentId}
        attachments={attachments}
        onAttachmentAdded={(att) => setAttachments(prev => [...prev, att])}
      />

      {/* ── Summary row: tax settings (2fr) + totals (3fr) — matches UI Kit ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* Tax Mode & Discount */}
        <div className="lg:col-span-2">
          <div className="card form-section-card">
            <h3 className="invoice-section-title font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              ตั้งค่าภาษี
            </h3>
              <div className="invoice-vat-mode-switch flex rounded-lg bg-[var(--color-bg-secondary)]">
                {(['exclusive', 'inclusive'] as VatMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVatMode(mode)}
                    className={`invoice-vat-mode-btn flex-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      vatMode === mode
                        ? 'bg-[var(--color-surface-solid)] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                        : 'bg-transparent text-[var(--color-text-muted)] shadow-none'
                    }`}
                  >
                    {mode === 'exclusive' ? 'ราคาแยกภาษี' : 'ราคารวมภาษี'}
                  </button>
                ))}
              </div>
              <div>
                <label className="invoice-field-label text-xs font-medium block text-[var(--color-text-muted)]">
                  ส่วนลดรวม (บาท)
                </label>
                <input
                  type="number"
                  className="input-field"
                  min={0}
                  step={0.01}
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="mt-4">
                <label className="invoice-field-label text-xs font-medium block text-[var(--color-text-muted)]">
                  หักภาษี ณ ที่จ่าย (WHT)
                </label>
                <select
                  className="input-field mt-1"
                  value={whtRate}
                  onChange={(e) => setWhtRate(Number(e.target.value))}
                >
                  <option value={0}>ไม่มีหัก ณ ที่จ่าย (0%)</option>
                  <option value={1}>1% - ค่าขนส่ง</option>
                  <option value={3}>3% - ค่าบริการ/รับจ้างทำของ</option>
                  <option value={5}>5% - ค่าเช่า</option>
                </select>
              </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="lg:col-span-3">
          <div className="glass-card form-section-card">
              <h3 className="invoice-section-title font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                สรุปยอดรวม
              </h3>
              <div className="form-stack-sm">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">ยอดรวมก่อนส่วนลด</span>
                  <span className="font-semibold tabular-nums">{formatNumber(totals.subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">ส่วนลดรวม</span>
                    <span className="font-semibold text-red-500 tabular-nums">-{formatNumber(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">
                    ยอดรวม{vatMode === 'inclusive' ? '' : 'ก่อน'}ภาษี
                  </span>
                  <span className="font-semibold tabular-nums">{formatNumber(totals.totalBeforeVat)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">
                    ภาษีมูลค่าเพิ่ม 7%
                    <span className="invoice-vat-mode-note text-xs opacity-60">({vatMode === 'exclusive' ? 'แยก' : 'รวม'})</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatNumber(totals.vatAmount)}</span>
                </div>

                {whtRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">หัก ณ ที่จ่าย {whtRate}%</span>
                    <span className="font-semibold text-red-500 tabular-nums">-{formatNumber(totals.whtAmount)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="invoice-grand-total-row flex justify-between items-center border-t border-[var(--color-border)]">
                  <span className="font-bold text-base text-[var(--color-text)]">
                    ยอดรวมสุทธิ
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">
                    ฿{formatNumber(totals.grandTotal)}
                  </span>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        documentId={documentId}
        documentNumber={`${config.prefix}-202606-AUTO`}
        amount={totals.grandTotal}
        onSuccess={() => {
          setPaymentModalOpen(false);
          // Optional: trigger refresh if needed
        }}
      />
      
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={(customer) => {
          setCustomerId(customer.id);
          setCustomerName(customer.name);
          setCustomerTaxId(customer.taxId || '');
          setCustomerAddress(customer.address || '');
          setCustomerBranch(customer.branch || 'สำนักงานใหญ่');
          clearError('customerName');
          clearError('customerTaxId');
          setCustomerModalOpen(false);
        }}
      />
    </div>
  );
}
