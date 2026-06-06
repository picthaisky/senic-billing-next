import { useState, useEffect } from 'react';
import { CalendarClock, Trash2, Power } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

type RecurringInvoiceDto = {
  id: string;
  sourceDocumentId: string;
  frequency: string;
  nextRunDate: string;
  isActive: boolean;
  maxOccurrences: number | null;
  currentOccurrence: number;
};

export default function RecurringInvoicesConfig() {
  const [invoices, setInvoices] = useState<RecurringInvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecurring();
  }, []);

  const fetchRecurring = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/RecurringInvoice');
      setInvoices(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch recurring invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, current: RecurringInvoiceDto) => {
    try {
      await apiClient.put(`/RecurringInvoice/${id}`, {
        frequency: current.frequency,
        nextRunDate: current.nextRunDate,
        isActive: !current.isActive,
        maxOccurrences: current.maxOccurrences
      });
      fetchRecurring();
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบกำหนดการนี้?')) return;
    try {
      await apiClient.delete(`/RecurringInvoice/${id}`);
      fetchRecurring();
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  return (
    <div className="card form-section-card p-5">
      <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
        <CalendarClock size={20} className="text-[var(--color-primary)]" />
        การออกเอกสารอัตโนมัติ (Recurring Invoices)
      </h3>
      <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
        จัดการกำหนดการออกเอกสารรายเดือน/รายปี อัตโนมัติ
      </p>

      {loading ? (
        <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">กำลังโหลด...</div>
      ) : (
        <div className="mt-4 border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface-solid)]">
          <div className="table-responsive">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>ความถี่</th>
                  <th>รอบถัดไป</th>
                  <th>สถานะ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[var(--color-text-muted)] py-8">
                      ยังไม่มีการตั้งค่าออกเอกสารอัตโนมัติ<br/>
                      <span className="text-xs">(คุณสามารถตั้งค่าได้ในหน้าสร้างเอกสาร)</span>
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="capitalize">{inv.frequency}</td>
                      <td>{new Date(inv.nextRunDate).toLocaleDateString('th-TH')}</td>
                      <td>
                        <span className={`badge ${inv.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {inv.isActive ? 'ทำงานอยู่' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleActive(inv.id, inv)}
                            className={`p-1.5 rounded-md hover:bg-[var(--color-surface)] ${inv.isActive ? 'text-orange-500' : 'text-green-600'}`}
                            title={inv.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                          >
                            <Power size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(inv.id)}
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
    </div>
  );
}
