import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Trash2, Power, Plus, X, Save } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/errorUtils';

type RecurringInvoiceDto = {
  id: string;
  sourceDocumentId: string;
  frequency: string;
  nextRunDate: string;
  isActive: boolean;
  maxOccurrences: number | null;
  currentOccurrence: number;
  sourceDocumentNumber?: string | null;
  customerName?: string | null;
  documentType?: string | null;
};

type SourceDocumentOption = {
  id: string;
  documentNumber: string;
  customerName: string;
  grandTotal: number;
  documentTypeLabel: string;
};

const FREQUENCY_LABELS: Record<string, string> = {
  Daily: 'รายวัน (Daily)',
  Weekly: 'รายสัปดาห์ (Weekly)',
  Monthly: 'รายเดือน (Monthly)',
  Yearly: 'รายปี (Yearly)',
};

const getDefaultNextRunDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
};

export default function RecurringInvoicesConfig() {
  const [invoices, setInvoices] = useState<RecurringInvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sourceDocs, setSourceDocs] = useState<SourceDocumentOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    sourceDocumentId: '',
    frequency: 'Monthly',
    nextRunDate: getDefaultNextRunDate(),
    maxOccurrences: '',
  });

  const loadRecurring = useCallback(async (): Promise<RecurringInvoiceDto[]> => {
    const res = await apiClient.get('/RecurringInvoice');
    return (res.data.data || []) as RecurringInvoiceDto[];
  }, []);

  const fetchRecurring = useCallback(async () => {
    try {
      setLoading(true);
      const list = await loadRecurring();
      setInvoices(list);
    } catch (error) {
      console.error('Failed to fetch recurring invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [loadRecurring]);

  useEffect(() => {
    let active = true;
    loadRecurring()
      .then((list) => {
        if (active) setInvoices(list);
      })
      .catch((error) => {
        console.error('Failed to fetch recurring invoices:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRecurring]);

  const openCreateModal = async () => {
    setIsModalOpen(true);
    setFormData({
      sourceDocumentId: '',
      frequency: 'Monthly',
      nextRunDate: getDefaultNextRunDate(),
      maxOccurrences: '',
    });

    try {
      setLoadingDocs(true);
      const sources: Array<{ endpoint: string; label: string }> = [
        { endpoint: '/tax-invoices?pageSize=50', label: 'ใบกำกับภาษี' },
        { endpoint: '/receipts?pageSize=50', label: 'ใบเสร็จรับเงิน' },
        { endpoint: '/quotations?pageSize=50', label: 'ใบเสนอราคา' },
        { endpoint: '/cashbills?pageSize=50', label: 'บิลเงินสด' },
      ];
      const results = await Promise.all(sources.map((s) => apiClient.get(s.endpoint)));
      const merged: SourceDocumentOption[] = [];
      results.forEach((res, idx) => {
        const items = (res.data?.data?.items || []) as Array<{
          id: string;
          documentNumber: string;
          customerName?: string;
          grandTotal: number;
          status?: string;
        }>;
        items
          .filter((d) => d.status !== 'Cancelled')
          .forEach((d) => {
            merged.push({
              id: d.id,
              documentNumber: d.documentNumber,
              customerName: d.customerName || '-',
              grandTotal: Number(d.grandTotal || 0),
              documentTypeLabel: sources[idx].label,
            });
          });
      });
      setSourceDocs(merged);
      if (merged.length > 0) {
        setFormData((prev) => ({ ...prev, sourceDocumentId: merged[0].id }));
      }
    } catch (error) {
      console.error('Failed to load source documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sourceDocumentId) {
      alert('กรุณาเลือกเอกสารต้นฉบับ');
      return;
    }

    try {
      setIsSaving(true);
      await apiClient.post('/RecurringInvoice', {
        sourceDocumentId: formData.sourceDocumentId,
        frequency: formData.frequency,
        nextRunDate: new Date(formData.nextRunDate).toISOString(),
        maxOccurrences: formData.maxOccurrences ? Number(formData.maxOccurrences) : null,
      });
      setIsModalOpen(false);
      await fetchRecurring();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถสร้างกำหนดการออกเอกสารอัตโนมัติได้'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, current: RecurringInvoiceDto) => {
    try {
      await apiClient.put(`/RecurringInvoice/${id}`, {
        frequency: current.frequency,
        nextRunDate: current.nextRunDate,
        isActive: !current.isActive,
        maxOccurrences: current.maxOccurrences,
      });
      await fetchRecurring();
    } catch {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบกำหนดการนี้?')) return;
    try {
      await apiClient.delete(`/RecurringInvoice/${id}`);
      await fetchRecurring();
    } catch {
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  return (
    <div className="card form-section-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
            <CalendarClock size={20} className="text-[var(--color-primary)]" />
            การออกเอกสารอัตโนมัติ (Recurring Invoices)
          </h3>
          <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
            จัดการกำหนดการออกเอกสารรายเดือน/รายปี อัตโนมัติจากเอกสารต้นฉบับ
          </p>
        </div>
        <button type="button" onClick={() => void openCreateModal()} className="btn btn-primary self-start sm:self-auto">
          <Plus size={16} /> สร้างกำหนดการอัตโนมัติ
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">กำลังโหลด...</div>
      ) : (
        <div className="mt-4 border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface-solid)]">
          <div className="table-responsive">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>เอกสารต้นฉบับ</th>
                  <th>ลูกค้า</th>
                  <th>ความถี่</th>
                  <th>รอบถัดไป</th>
                  <th>จำนวนครั้ง</th>
                  <th>สถานะ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[var(--color-text-muted)] py-8">
                      ยังไม่มีการตั้งค่าออกเอกสารอัตโนมัติ<br />
                      <span className="text-xs">คลิก "สร้างกำหนดการอัตโนมัติ" เพื่อเลือกเอกสารต้นฉบับ</span>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-mono text-sm font-semibold text-[var(--color-primary)]">
                        {inv.sourceDocumentNumber || inv.sourceDocumentId.slice(0, 8)}
                      </td>
                      <td>{inv.customerName || '-'}</td>
                      <td>{FREQUENCY_LABELS[inv.frequency] || inv.frequency}</td>
                      <td>{new Date(inv.nextRunDate).toLocaleDateString('th-TH')}</td>
                      <td className="tabular-nums">
                        {inv.currentOccurrence} / {inv.maxOccurrences ?? '∞'}
                      </td>
                      <td>
                        <span className={`badge ${inv.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {inv.isActive ? 'ทำงานอยู่' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleActive(inv.id, inv)}
                            className={`p-1.5 rounded-md hover:bg-[var(--color-surface)] ${inv.isActive ? 'text-orange-500' : 'text-green-600'}`}
                            title={inv.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                          >
                            <Power size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(inv.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                            title="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)]">
            <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">สร้างกำหนดการออกเอกสารอัตโนมัติ</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="form-modal-content form-stack-md">
              <div>
                <label className="layout-form-label-sm block text-sm font-medium">เอกสารต้นฉบับ *</label>
                <select
                  required
                  className="input-field"
                  value={formData.sourceDocumentId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sourceDocumentId: e.target.value }))}
                  disabled={loadingDocs}
                >
                  {loadingDocs ? (
                    <option value="">กำลังโหลดเอกสาร...</option>
                  ) : sourceDocs.length === 0 ? (
                    <option value="">ไม่พบเอกสารต้นฉบับ (กรุณาสร้างเอกสารก่อน)</option>
                  ) : (
                    sourceDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.documentTypeLabel}] {d.documentNumber} — {d.customerName} (฿{d.grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">ความถี่ *</label>
                  <select
                    className="input-field"
                    value={formData.frequency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, frequency: e.target.value }))}
                  >
                    <option value="Monthly">รายเดือน (Monthly)</option>
                    <option value="Weekly">รายสัปดาห์ (Weekly)</option>
                    <option value="Daily">รายวัน (Daily)</option>
                    <option value="Yearly">รายปี (Yearly)</option>
                  </select>
                </div>
                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">วันที่เริ่มรอบถัดไป *</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={formData.nextRunDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nextRunDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="layout-form-label-sm block text-sm font-medium">จำนวนครั้งสูงสุด (เว้นว่าง = ไม่จำกัด)</label>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  placeholder="เช่น 12"
                  value={formData.maxOccurrences}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxOccurrences: e.target.value }))}
                />
              </div>
              <div className="form-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">ยกเลิก</button>
                <button type="submit" disabled={isSaving || sourceDocs.length === 0} className="btn btn-primary">
                  <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกกำหนดการ'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
