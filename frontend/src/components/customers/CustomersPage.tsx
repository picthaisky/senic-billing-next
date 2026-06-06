import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit2, Trash2, MapPin, Phone, X, Save, Download } from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';

// First meaningful character for the avatar tile (strips common Thai prefixes)
const getInitial = (name: string) =>
  name.replace(/^(บจก\.|บมจ\.|หจก\.|ร้าน|คุณ)\s*/, '').charAt(0) || '?';
import { apiClient } from '../../services/apiClient';

interface Customer {
  id: string;
  name: string;
  branch: string;
  taxId: string;
  address: string;
  phone: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update a field and clear its inline error as the user types
  const setField = (key: keyof Customer, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name?.trim()) e.name = 'กรุณากรอกชื่อลูกค้า / บริษัท';
    if (!formData.branch?.trim()) e.branch = 'กรุณากรอกสาขา';
    if (!formData.taxId?.trim()) e.taxId = 'กรุณากรอกเลขประจำตัวผู้เสียภาษี';
    else if (!/^\d{13}$/.test(formData.taxId.trim())) e.taxId = 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก';
    if (!formData.address?.trim()) e.address = 'กรุณากรอกที่อยู่';
    if (formData.phone?.trim() && !/^[0-9+\-\s()]{6,}$/.test(formData.phone.trim())) e.phone = 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/customers');
      if (res.data?.success && res.data?.data?.items) {
        setCustomers(res.data.data.items);
      } else {
        setCustomers([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setLoading(false);
    }
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', branch: 'สำนักงานใหญ่', taxId: '', address: '', phone: '' });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setIsSaving(true);
      if (editingCustomer) {
        await apiClient.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await apiClient.post(`/customers`, formData);
      }
      
      await fetchCustomers();
      setIsModalOpen(false);
      setIsSaving(false);
    } catch (error) {
      console.error('Save failed', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('คุณต้องการลบลูกค้ารายนี้ใช่หรือไม่?')) {
      try {
        await apiClient.delete(`/customers/${id}`);
        await fetchCustomers();
      } catch (error) {
        console.error('Delete failed', error);
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.taxId.includes(search)
  );

  const handleExport = () => {
    const mapping = {
      name: 'ชื่อลูกค้า/บริษัท',
      branch: 'สาขา',
      taxId: 'เลขประจำตัวผู้เสียภาษี',
      address: 'ที่อยู่',
      phone: 'เบอร์โทรศัพท์'
    };
    exportToExcel(filteredCustomers, 'Customers', mapping);
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">รายชื่อลูกค้า</h2>
          <p className="entity-page-subtitle text-sm text-[var(--color-text-muted)]">
            ทั้งหมด <span className="font-semibold text-[var(--color-text-secondary)]">{customers.length}</span> ราย
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อลูกค้า, เลขผู้เสียภาษี..." 
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button className="btn btn-secondary flex-1 sm:flex-none" onClick={handleExport}>
            <Download size={16} /> ส่งออก Excel
          </button>
          <button className="btn btn-primary flex-1 sm:flex-none" onClick={() => handleOpenModal()}>
            <Plus size={16} /> เพิ่มลูกค้าใหม่
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table table-responsive">
          <thead>
            <tr>
              <th>ชื่อลูกค้า / บริษัท</th>
              <th>สาขา</th>
              <th>เลขประจำตัวผู้เสียภาษี</th>
              <th>ข้อมูลติดต่อ</th>
              <th className="w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  ไม่พบข้อมูลลูกค้า
                </td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className="animate-fade-in">
                  <td data-label="ชื่อลูกค้า / บริษัท">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                        {getInitial(customer.name)}
                      </div>
                      <span className="font-semibold text-sm">{customer.name}</span>
                    </div>
                  </td>
                  <td data-label="สาขา"><span className="badge badge-neutral">{customer.branch}</span></td>
                  <td data-label="เลขประจำตัวผู้เสียภาษี" className="font-mono text-sm">{customer.taxId}</td>
                  <td data-label="ข้อมูลติดต่อ">
                    <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                      <span className="flex items-center gap-1 truncate max-w-[200px]" title={customer.address}>
                        <MapPin size={12} /> {customer.address}
                      </span>
                    </div>
                  </td>
                  <td data-label="จัดการ">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => handleOpenModal(customer)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors" title="แก้ไข" aria-label={`แก้ไข ${customer.name}`}>
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(customer.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors" title="ลบ" aria-label={`ลบ ${customer.name}`}>
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

      {/* Modal Form — portaled to <body> so it escapes the transformed page wrapper.
          Backdrop click is intentionally NOT a close trigger (prevents accidental dismissal). */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)] ">
            <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">{editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="ปิดหน้าต่าง" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} noValidate className="form-modal-content form-stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">ชื่อลูกค้า / บริษัท *</label>
                  <input type="text" className={`input-field ${errors.name ? 'input-error' : ''}`} value={formData.name || ''} title="ชื่อลูกค้า / บริษัท" placeholder="กรอกชื่อลูกค้า / บริษัท"
                    onChange={e => setField('name', e.target.value)} />
                  {errors.name && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.name}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">สาขา *</label>
                  <input type="text" className={`input-field ${errors.branch ? 'input-error' : ''}`} value={formData.branch || ''} title="สาขา" placeholder="กรอกสาขา"
                    onChange={e => setField('branch', e.target.value)} />
                  {errors.branch && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.branch}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">เลขผู้เสียภาษี *</label>
                  <input type="text" inputMode="numeric" maxLength={13} className={`input-field font-mono ${errors.taxId ? 'input-error' : ''}`} value={formData.taxId || ''} title="เลขประจำตัวผู้เสียภาษี (13 หลัก)" placeholder="เลข 13 หลัก"
                    onChange={e => setField('taxId', e.target.value.replace(/\D/g, ''))} />
                  {errors.taxId && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.taxId}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">ที่อยู่ *</label>
                  <input type="text" className={`input-field ${errors.address ? 'input-error' : ''}`} value={formData.address || ''} title="ที่อยู่" placeholder="กรอกที่อยู่"
                    onChange={e => setField('address', e.target.value)} />
                  {errors.address && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.address}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">เบอร์โทรศัพท์</label>
                  <input type="text" inputMode="tel" className={`input-field ${errors.phone ? 'input-error' : ''}`} value={formData.phone || ''} title="เบอร์โทรศัพท์" placeholder="เช่น 02-123-4567"
                    onChange={e => setField('phone', e.target.value)} />
                  {errors.phone && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.phone}</p>}
                </div>
              </div>
              
              <div className="form-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
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
