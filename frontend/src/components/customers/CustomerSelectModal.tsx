import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MapPin } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

export interface Customer {
  id: string;
  name: string;
  branch: string;
  taxId: string;
  address: string;
  phone: string;
}

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

export default function CustomerSelectModal({ isOpen, onClose, onSelect }: CustomerSelectModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/customers');
      if (res.data?.success && res.data?.data?.items) {
        setCustomers(res.data.data.items);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.taxId || '').includes(search)
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="rounded-2xl shadow-xl w-full max-w-2xl border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)] my-auto flex flex-col max-h-[85vh]">
        <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
          <h3 className="font-bold text-lg">เลือกข้อมูลลูกค้า</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="ปิดหน้าต่าง" aria-label="ปิดหน้าต่าง">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้า, เลขผู้เสียภาษี..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="py-8 text-center text-[var(--color-text-muted)]">กำลังโหลดข้อมูล...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-muted)]">ไม่พบรายชื่อลูกค้า</div>
          ) : (
            <div className="grid gap-2">
              {filteredCustomers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => onSelect(customer)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-transparent hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] transition-all text-left gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[var(--color-text)] mb-1 truncate">{customer.name}</h4>
                    <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="truncate">เลขประจำตัวผู้เสียภาษี: {customer.taxId || '-'}</span>
                      <span className="truncate">สาขา: {customer.branch || 'สำนักงานใหญ่'}</span>
                      {customer.phone && <span className="truncate">โทร: {customer.phone}</span>}
                    </div>
                    {customer.address && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-start gap-1">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <div className="px-4 py-2 bg-[var(--color-surface)] text-[var(--color-primary)] text-sm font-medium rounded-lg whitespace-nowrap group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors border border-[var(--color-border)]">
                      เลือกรายการ
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
