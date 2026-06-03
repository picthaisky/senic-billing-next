import { Plus, Trash2, Save, Printer, RotateCcw, CreditCard } from 'lucide-react';
import { useDocumentForm, type VatMode } from '../../hooks/useDocumentForm';
import { useCallback, useState } from 'react';
import { apiClient } from '../../services/apiClient';

import AttachmentUpload from './AttachmentUpload';
import PaymentModal from '../payments/PaymentModal';

interface InvoiceFormProps {
  documentType: string;
  title: string;
}

const docTypeLabels: Record<string, { prefix: string; color: string }> = {
  taxinvoice: { prefix: 'INV', color: '#ea580c' },
  receipt: { prefix: 'RCP', color: '#16a34a' },
  cashbill: { prefix: 'CSB', color: '#2563eb' },
  delivery: { prefix: 'DLV', color: '#9333ea' },
};

export default function InvoiceForm({ documentType, title }: InvoiceFormProps) {
  const { lines, addLine, removeLine, updateLine, vatMode, setVatMode, discountAmount, setDiscountAmount, totals, resetForm } = useDocumentForm(7);
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const [documentId] = useState(() => crypto.randomUUID());
  const [attachments, setAttachments] = useState<any[]>([]);

  const config = docTypeLabels[documentType] || docTypeLabels.taxinvoice;
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
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-12 rounded-full"
            style={{ background: config.color }}
          />
          <div>
            <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              เลขที่เอกสาร: <span className="font-mono font-semibold" style={{ color: config.color }}>
                {config.prefix}-{new Date().toISOString().slice(0, 7).replace('-', '')}-AUTO
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons — wrap on small screens */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={resetForm} className="btn btn-ghost" title="รีเซ็ตฟอร์ม" disabled={isSaving}>
            <RotateCcw size={15} /> ล้างข้อมูล
          </button>
          <button className="btn btn-secondary" onClick={() => window.open('/print/draft', '_blank')} disabled={isSaving}>
            <Printer size={15} /> พิมพ์
          </button>
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="btn btn-secondary"
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              color: '#4f46e5',
              borderColor: 'rgba(99, 102, 241, 0.25)',
            }}
          >
            <CreditCard size={15} /> ชำระเงินออนไลน์
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
            <Save size={15} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
          </button>
        </div>
      </div>

      {/* ── Customer Info Card ── */}
      <div className="card p-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ข้อมูลลูกค้า
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
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
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
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
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
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
        <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            รายการสินค้า / บริการ
          </h3>
          <button onClick={addLine} className="btn btn-ghost text-xs">
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                <th>รายละเอียด</th>
                <th style={{ width: '88px', textAlign: 'right' }}>จำนวน</th>
                <th style={{ width: '72px' }}>หน่วย</th>
                <th style={{ width: '120px', textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ width: '100px', textAlign: 'right' }}>ส่วนลด</th>
                <th style={{ width: '120px', textAlign: 'right' }}>รวม</th>
                <th style={{ width: '44px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} className="animate-fade-in">
                  <td className="text-center font-mono text-sm align-middle" style={{ color: 'var(--color-text-muted)' }}>
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
                      className="input-field !py-2 !px-2.5 !text-sm text-center"
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
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
                      className="input-field !py-2 !px-2.5 !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.discountAmount || ''}
                      onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="text-right font-semibold text-sm tabular-nums align-middle pr-3" style={{ color: 'var(--color-text)' }}>
                    {formatNumber(line.lineTotal)}
                  </td>
                  <td className="text-center align-middle">
                    <button
                      onClick={() => removeLine(line.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                      style={{ color: lines.length === 1 ? 'var(--color-text-muted)' : '#dc2626' }}
                      disabled={lines.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* VAT Mode & Discount (narrower — 2/5) */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
            ตั้งค่าภาษี
          </h3>
          <div className="flex p-1 rounded-lg mb-4" style={{ background: 'var(--color-bg-secondary)' }}>
            {(['exclusive', 'inclusive'] as VatMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setVatMode(mode)}
                className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200"
                style={{
                  background: vatMode === mode ? 'var(--color-surface-solid)' : 'transparent',
                  color: vatMode === mode ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: vatMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {mode === 'exclusive' ? 'ราคาแยกภาษี' : 'ราคารวมภาษี'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
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

        {/* Totals (wider — 3/5) */}
        <div className="lg:col-span-3 glass-card p-5">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
            สรุปยอดรวม
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>ยอดรวมก่อนส่วนลด</span>
              <span className="font-semibold tabular-nums">{formatNumber(totals.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-secondary)' }}>ส่วนลดรวม</span>
                <span className="font-semibold text-red-500 tabular-nums">-{formatNumber(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                ยอดรวม{vatMode === 'inclusive' ? '' : 'ก่อน'}ภาษี
              </span>
              <span className="font-semibold tabular-nums">{formatNumber(totals.totalBeforeVat)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                ภาษีมูลค่าเพิ่ม 7%
                <span className="text-xs ml-1 opacity-60">({vatMode === 'exclusive' ? 'แยก' : 'รวม'})</span>
              </span>
              <span className="font-semibold tabular-nums">{formatNumber(totals.vatAmount)}</span>
            </div>

            {/* Grand Total */}
            <div
              className="flex justify-between items-center pt-3 mt-3 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                ยอดรวมสุทธิ
              </span>
              <span
                className="text-2xl font-extrabold tabular-nums"
                style={{ color: 'var(--color-primary)' }}
              >
                ฿{formatNumber(totals.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Attachments ── */}
      <AttachmentUpload 
        documentId={documentId} 
        attachments={attachments} 
        onAttachmentAdded={(att) => setAttachments(prev => [...prev, att])} 
      />

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
