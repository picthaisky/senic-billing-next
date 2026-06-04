import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Package, X, Save, Download } from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';
// import { apiClient } from '../../services/apiClient';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  unit: string;
}

const mockProducts: Product[] = [
  { id: '1', sku: 'P-001', name: 'กระดาษ A4 80 แกรม', category: 'เครื่องใช้สำนักงาน', unitPrice: 120, unit: 'รีม' },
  { id: '2', sku: 'P-002', name: 'หมึกพิมพ์ Toner', category: 'อุปกรณ์ไอที', unitPrice: 1500, unit: 'ตลับ' },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // const res = await apiClient.get('/products');
      // setProducts(res.data);
      setTimeout(() => {
        setProducts(mockProducts);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', sku: '', category: 'สินค้าทั่วไป', unitPrice: 0, unit: 'ชิ้น' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      // Simulate API call
      // if (editingProduct) await apiClient.put(`/products/${editingProduct.id}`, formData);
      // else await apiClient.post(`/products`, formData);
      
      setTimeout(() => {
        if (editingProduct) {
          setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...formData } as Product : p));
        } else {
          setProducts([...products, { ...formData, id: Math.random().toString(36).substring(2,9) } as Product]);
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
    if (window.confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const mapping = {
      sku: 'รหัสสินค้า (SKU)',
      name: 'ชื่อสินค้า/บริการ',
      category: 'หมวดหมู่',
      unitPrice: 'ราคาต่อหน่วย',
      unit: 'หน่วยนับ'
    };
    exportToExcel(filteredProducts, 'Products', mapping);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <div>
          <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text)' }}>รายการสินค้า / บริการ</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            ทั้งหมด <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{products.length}</span> รายการ
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อสินค้า, รหัส SKU..." 
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
            <Plus size={16} /> เพิ่มสินค้าใหม่
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table table-responsive">
          <thead>
            <tr>
              <th>รหัสสินค้า (SKU)</th>
              <th>ชื่อสินค้า / บริการ</th>
              <th>หมวดหมู่</th>
              <th className="text-right">ราคาต่อหน่วย</th>
              <th>หน่วยนับ</th>
              <th className="w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  ไม่พบข้อมูลสินค้า
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="animate-fade-in haptic-tap">
                  <td data-label="รหัสสินค้า (SKU)" className="font-mono text-sm">{product.sku}</td>
                  <td data-label="ชื่อสินค้า / บริการ">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Package size={14} style={{ color: 'var(--color-primary)' }} />
                      {product.name}
                    </div>
                  </td>
                  <td data-label="หมวดหมู่"><span className="badge badge-info">{product.category}</span></td>
                  <td data-label="ราคาต่อหน่วย" className="text-right font-semibold tabular-nums">฿{formatCurrency(product.unitPrice)}</td>
                  <td data-label="หน่วยนับ"><span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{product.unit}</span></td>
                  <td data-label="จัดการ">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenModal(product)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors haptic-tap" title="แก้ไข">
                        <Edit2 size={14} style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors group haptic-tap" title="ลบ">
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
          <div className="rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden" style={{ backgroundColor: 'var(--color-surface-solid)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-bold text-lg">{editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">ชื่อสินค้า / บริการ *</label>
                  <input required type="text" className="input-field" value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">รหัสสินค้า (SKU) *</label>
                  <input required type="text" className="input-field" value={formData.sku || ''} 
                    onChange={e => setFormData({...formData, sku: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">หมวดหมู่ *</label>
                  <input required type="text" className="input-field" value={formData.category || ''} 
                    onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">ราคาต่อหน่วย (บาท) *</label>
                  <input required type="number" min={0} step={0.01} className="input-field text-right" value={formData.unitPrice || ''} 
                    onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">หน่วยนับ *</label>
                  <input required type="text" className="input-field" value={formData.unit || ''} 
                    onChange={e => setFormData({...formData, unit: e.target.value})} />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
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
