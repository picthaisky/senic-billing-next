import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, MapPin, Phone, Building2, X, Save } from 'lucide-react';
// import { apiClient } from '../../services/apiClient';

interface Customer {
  id: string;
  name: string;
  branch: string;
  taxId: string;
  address: string;
  phone: string;
}

// Mock Data as fallback
const mockCustomers: Customer[] = [
  { id: '1', name: 'บจก. เอบีซี', branch: 'สำนักงานใหญ่', taxId: '0105550000001', address: '123 ถ.สุขุมวิท กรุงเทพฯ', phone: '02-111-1111' },
  { id: '2', name: 'ร้านมิตรภาพ', branch: 'สาขา 1', taxId: '0105550000002', address: '456 ถ.สีลม กรุงเทพฯ', phone: '02-222-2222' },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // const res = await apiClient.get('/customers');
      // setCustomers(res.data);
      setTimeout(() => {
        setCustomers(mockCustomers);
        setLoading(false);
      }, 500);
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
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      // Simulate API call
      // if (editingCustomer) await apiClient.put(`/customers/${editingCustomer.id}`, formData);
      // else await apiClient.post(`/customers`, formData);
      
      setTimeout(() => {
        if (editingCustomer) {
          setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...formData } as Customer : c));
        } else {
          setCustomers([...customers, { ...formData, id: Math.random().toString(36).substring(2,9) } as Customer]);
        }
        setIsModalOpen(false);
        setIsSaving(false);
      }, 500);
    } catch (error) {
      console.error('Save failed', error);
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('คุณต้องการลบลูกค้ารายนี้ใช่หรือไม่?')) {
      // await apiClient.delete(`/customers/${id}`);
      setCustomers(customers.filter(c => c.id !== id));
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.taxId.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อลูกค้า, เลขผู้เสียภาษี..." 
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <Plus size={16} /> เพิ่มลูกค้าใหม่
        </button>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
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
                <td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  ไม่พบข้อมูลลูกค้า
                </td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className="animate-fade-in">
                  <td>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Building2 size={14} style={{ color: 'var(--color-primary)' }} />
                      {customer.name}
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{customer.branch}</span></td>
                  <td className="font-mono text-sm">{customer.taxId}</td>
                  <td>
                    <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                      <span className="flex items-center gap-1 truncate max-w-[200px]" title={customer.address}>
                        <MapPin size={12} /> {customer.address}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenModal(customer)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="แก้ไข">
                        <Edit2 size={14} style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                      <button onClick={() => handleDelete(customer.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors group" title="ลบ">
                        <Trash2 size={14} className="text-red-400 group-hover:text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg border dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800">
              <h3 className="font-bold text-lg">{editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">ชื่อลูกค้า / บริษัท *</label>
                  <input required type="text" className="input-field" value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">สาขา *</label>
                  <input required type="text" className="input-field" value={formData.branch || ''} 
                    onChange={e => setFormData({...formData, branch: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">เลขผู้เสียภาษี *</label>
                  <input required type="text" className="input-field" value={formData.taxId || ''} 
                    onChange={e => setFormData({...formData, taxId: e.target.value})} />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">ที่อยู่ *</label>
                  <input required type="text" className="input-field" value={formData.address || ''} 
                    onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">เบอร์โทรศัพท์</label>
                  <input type="text" className="input-field" value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
