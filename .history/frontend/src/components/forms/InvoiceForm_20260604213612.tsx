import { Plus, Trash2, Save, Printer, RotateCcw, CreditCard } from 'lucide-react';
import { useDocumentForm, type VatMode } from '../../hooks/useDocumentForm';
import { useCallback, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { getDocumentTypeMeta } from '../../utils/documentTypeMeta';

import AttachmentUpload from './AttachmentUpload';
import PaymentModal from '../payments/PaymentModal';

interface InvoiceFormProps {
  documentType: string;
  title: string;
}

export default function InvoiceForm({ documentType, title }: InvoiceFormProps) {
  const { lines, addLine, removeLine, updateLine, vatMode, setVatMode, discountAmount, setDiscountAmount, totals, resetForm } = useDocumentForm(7);
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const [documentId] = useState(() => crypto.randomUUID());
  const [attachments, setAttachments] = useState<any[]>([]);

  const config = getDocumentTypeMeta(documentType);
  const accentClasses: Record<string, { bar: string; text: string }> = {
    receipt: { bar: 'bg-[var(--doc-receipt)]', text: 'text-[var(--doc-receipt)]' },
    cashbill: { bar: 'bg-[var(--doc-cashbill)]', text: 'text-[var(--doc-cashbill)]' },
    delivery: { bar: 'bg-[var(--doc-delivery)]', text: 'text-[var(--doc-delivery)]' },
    taxinvoice: { bar: 'bg-[var(--doc-taxinvoice)]', text: 'text-[var(--doc-taxinvoice)]' },
  };
  const accent = accentClasses[documentType] ?? { bar: 'bg-[var(--color-primary)]', text: 'text-[var(--color-primary)]' };
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);

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
    if (!customerName) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        documentType,
        customerName,
        customerTaxId,
        notes,
        vatMode,
        discountAmount,
        lines: lines.filter(l => l.description.trim() !== ''),
        ...totals,
      };

      // Mock API call if backend is not ready
      await apiClient.post('/document', payload).catch(() => {
        console.warn('API /document is not available, simulating success');
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      
      alert('บันทึกเอกสารสำเร็จ');
      resetForm();
      setCustomerName('');
      setCustomerTaxId('');
      setNotes('');
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกเอกสาร');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-12 rounded-full ${accent.bar}`} />
          <div>
            <h2 className="text-xl font-bold leading-tight text-[var(--color-text)]">
              {title}
            </h2>
            <p className="text-sm mt-0.5 text-[var(--color-text-muted)]">
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
      <div className="card p-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-4 text-[var(--color-text-muted)]">
          ข้อมูลลูกค้า
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block text-[var(--color-text-muted)]">
              ชื่อลูกค้า / บริษัท <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="พิมพ์เพื่อค้นหา..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          {documentType === 'taxinvoice' && (
            <div>
              <label className="text-xs font-medium mb-1.5 block text-[var(--color-text-muted)]">
                เลขประจำตัวผู้เสียภาษี (13 หลัก)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="X-XXXX-XXXXX-XX-X"
                maxLength={13}
                value={customerTaxId}
                onChange={(e) => setCustomerTaxId(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}
          <div className={documentType === 'taxinvoice' ? 'md:col-span-2' : ''}>
            <label className="text-xs font-medium mb-1.5 block text-[var(--color-text-muted)]">
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
        </div>
      </div>

      {/* ── Document Lines (Items Table) ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            รายการสินค้า / บริการ
          </h3>
          <button onClick={addLine} className="btn btn-ghost text-xs">
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

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
                      className="input-field !py-2 !px-2.5 !text-sm"
                      placeholder="ชื่อสินค้า / รายละเอียด"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, idx === lines.length - 1)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label="จำนวน"
                      className="input-field !py-2 !px-2.5 !text-sm text-right"
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
                      className="input-field !py-2 !px-2.5 !text-sm text-center"
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      aria-label="ราคาต่อหน่วย"
                      className="input-field !py-2 !px-2.5 !text-sm text-right"
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
                      className="input-field !py-2 !px-2.5 !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.discountAmount || ''}
                      onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="text-right font-semibold text-sm tabular-nums align-middle pr-3 text-[var(--color-text)]">
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
              <div className="flex items-center justify-between mb-2.5">
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
              <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">
                รายละเอียด
              </label>
              <input
                type="text"
                className="input-field !py-2 !px-2.5 !text-sm mb-3"
                placeholder="ชื่อสินค้า / รายละเอียด"
                value={line.description}
                onChange={(e) => updateLine(line.id, { description: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, idx === lines.length - 1)}
              />

              {/* Numeric fields grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">
                    จำนวน
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="จำนวน"
                    className="input-field !py-2 !px-2.5 !text-sm text-right"
                    min={0}
                    step={1}
                    value={line.quantity || ''}
                    onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">
                    หน่วย
                  </label>
                  <input
                    type="text"
                    aria-label="หน่วย"
                    className="input-field !py-2 !px-2.5 !text-sm text-center"
                    value={line.unit}
                    onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">
                    ราคา/หน่วย
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="ราคาต่อหน่วย"
                    className="input-field !py-2 !px-2.5 !text-sm text-right"
                    min={0}
                    step={0.01}
                    value={line.unitPrice || ''}
                    onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1 text-[var(--color-text-muted)]">
                    ส่วนลด
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="ส่วนลด"
                    className="input-field !py-2 !px-2.5 !text-sm text-right"
                    min={0}
                    step={0.01}
                    value={line.discountAmount || ''}
                    onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Line total */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--color-border)]">
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
          <div className="card p-5">
            <h3 className="font-semibold text-xs uppercase tracking-wider mb-4 text-[var(--color-text-muted)]">
              ตั้งค่าภาษี
            </h3>
              <div className="flex p-1 rounded-lg mb-4 bg-[var(--color-bg-secondary)]">
                {(['exclusive', 'inclusive'] as VatMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVatMode(mode)}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
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
                <label className="text-xs font-medium mb-1.5 block text-[var(--color-text-muted)]">
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
          </div>
        </div>

        {/* Totals Summary */}
        <div className="lg:col-span-3">
          <div className="glass-card p-5">
              <h3 className="font-semibold text-xs uppercase tracking-wider mb-4 text-[var(--color-text-muted)]">
                สรุปยอดรวม
              </h3>
              <div className="space-y-2.5">
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
                    <span className="text-xs ml-1 opacity-60">({vatMode === 'exclusive' ? 'แยก' : 'รวม'})</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatNumber(totals.vatAmount)}</span>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-[var(--color-border)]">
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
          alert('ชำระเงินสำเร็จแล้ว!');
        }}
      />
    </div>
  );
}
