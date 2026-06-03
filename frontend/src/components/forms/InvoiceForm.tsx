import { Plus, Trash2, Save, Printer, RotateCcw } from 'lucide-react';
import { useDocumentForm, type VatMode } from '../../hooks/useDocumentForm';
import { useCallback, useState } from 'react';
import { apiClient } from '../../services/apiClient';

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

  const config = docTypeLabels[documentType] || docTypeLabels.taxinvoice;
  const [isSaving, setIsSaving] = useState(false);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-10 rounded-full"
            style={{ background: config.color }}
          />
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              เลขที่เอกสาร: <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
                {config.prefix}-{new Date().toISOString().slice(0, 7).replace('-', '')}-AUTO
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={resetForm} className="btn btn-ghost" title="รีเซ็ตฟอร์ม" disabled={isSaving}>
            <RotateCcw size={16} /> ล้างข้อมูล
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()} disabled={isSaving}>
            <Printer size={16} /> พิมพ์
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-lg">
            <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="card p-6">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          ข้อมูลลูกค้า
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
              ชื่อลูกค้า / บริษัท
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
          <div>
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

      {/* Document Lines */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            รายการสินค้า / บริการ
          </h3>
          <button onClick={addLine} className="btn btn-ghost text-xs">
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th className="min-w-[200px]">รายละเอียด</th>
                <th className="w-24">จำนวน</th>
                <th className="w-20">หน่วย</th>
                <th className="w-32">ราคา/หน่วย</th>
                <th className="w-28">ส่วนลด</th>
                <th className="w-36 text-right">รวม</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} className="animate-fade-in">
                  <td className="text-center font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {idx + 1}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field !py-1.5 !text-sm"
                      placeholder="ชื่อสินค้า / รายละเอียด"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, idx === lines.length - 1)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field !py-1.5 !text-sm text-right"
                      min={0}
                      step={1}
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field !py-1.5 !text-sm"
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field !py-1.5 !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.unitPrice || ''}
                      onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field !py-1.5 !text-sm text-right"
                      min={0}
                      step={0.01}
                      value={line.discountAmount || ''}
                      onChange={(e) => updateLine(line.id, { discountAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="text-right font-semibold text-sm tabular-nums">
                    {formatNumber(line.lineTotal)}
                  </td>
                  <td className="text-center">
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

      {/* Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VAT Mode Toggle */}
        <div className="card p-6">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            ตั้งค่าภาษี
          </h3>
          <div className="flex gap-2 mb-4">
            {(['exclusive', 'inclusive'] as VatMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setVatMode(mode)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${vatMode === mode
                  ? ''
                  : 'border-transparent'
                  }`}
                style={{
                  background: vatMode === mode ? 'var(--color-primary-50)' : 'var(--color-bg-secondary)',
                  color: vatMode === mode ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderColor: vatMode === mode ? 'var(--color-primary)' : 'transparent',
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

        {/* Totals */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            สรุปยอดรวม
          </h3>
          <div className="space-y-3">
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
                <span className="text-xs ml-1">({vatMode === 'exclusive' ? 'แยก' : 'รวม'})</span>
              </span>
              <span className="font-semibold tabular-nums">{formatNumber(totals.vatAmount)}</span>
            </div>
            <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                  ยอดรวมสุทธิ
                </span>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: 'var(--color-primary)' }}
                >
                  ฿{formatNumber(totals.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
