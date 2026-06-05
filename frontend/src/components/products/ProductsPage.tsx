import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit2, Trash2, Package, X, Save, Download } from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';
import { apiClient } from '../../services/apiClient';
interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  unit: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: keyof Product, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name?.trim()) e.name = 'กรุณากรอกชื่อสินค้า / บริการ';
    if (!formData.sku?.trim()) e.sku = 'กรุณากรอกรหัสสินค้า (SKU)';
    if (!formData.category?.trim()) e.category = 'กรุณากรอกหมวดหมู่';
    if (formData.unitPrice == null || formData.unitPrice <= 0) e.unitPrice = 'ราคาต่อหน่วยต้องมากกว่า 0';
    if (!formData.unit?.trim()) e.unit = 'กรุณากรอกหน่วยนับ';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/products');
      // res.data is ApiResponse<PaginatedResponse<ProductDto>>
      if (res.data?.success && res.data?.data?.items) {
        setProducts(res.data.data.items);
      } else {
        setProducts([]);
      }
      setLoading(false);
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
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setIsSaving(true);
      const payload = {
        sku: formData.sku,
        name: formData.name,
        category: formData.category,
        unitPrice: formData.unitPrice,
        unit: formData.unit,
        description: formData.name, // using name as description if not separated
        stockQuantity: 0,
        isActive: true
      };

      if (editingProduct) {
        await apiClient.put(`/products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post(`/products`, payload);
      }
      
      await fetchProducts(); // Refresh list from backend
      setIsModalOpen(false);
      setIsSaving(false);
    } catch (error) {
      console.error('Save failed', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) {
      try {
        await apiClient.delete(`/products/${id}`);
        await fetchProducts(); // Refresh list from backend
      } catch (error) {
        console.error('Delete failed', error);
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
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
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">รายการสินค้า / บริการ</h2>
          <p className="entity-page-subtitle text-sm text-[var(--color-text-muted)]">
            ทั้งหมด <span className="font-semibold text-[var(--color-text-secondary)]">{products.length}</span> รายการ
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อสินค้า, รหัส SKU..." 
            className="input-field entity-search-input"
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
                <td colSpan={6} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  ไม่พบข้อมูลสินค้า
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="animate-fade-in">
                  <td data-label="รหัสสินค้า (SKU)" className="font-mono text-sm">{product.sku}</td>
                  <td data-label="ชื่อสินค้า / บริการ">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                        <Package size={15} />
                      </div>
                      <span className="font-semibold text-sm">{product.name}</span>
                    </div>
                  </td>
                  <td data-label="หมวดหมู่"><span className="badge badge-info">{product.category}</span></td>
                  <td data-label="ราคาต่อหน่วย" className="text-right font-semibold tabular-nums">฿{formatCurrency(product.unitPrice)}</td>
                  <td data-label="หน่วยนับ"><span className="text-sm text-[var(--color-text-secondary)]">{product.unit}</span></td>
                  <td data-label="จัดการ">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => handleOpenModal(product)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors" title="แก้ไข" aria-label={`แก้ไข ${product.name}`}>
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(product.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors" title="ลบ" aria-label={`ลบ ${product.name}`}>
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
          <div className="rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)] my-auto">
            <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">{editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="ปิดหน้าต่าง" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} noValidate className="form-modal-content form-stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">ชื่อสินค้า / บริการ *</label>
                  <input type="text" className={`input-field ${errors.name ? 'input-error' : ''}`} value={formData.name || ''} title="ชื่อสินค้า / บริการ" placeholder="กรอกชื่อสินค้า / บริการ"
                    onChange={e => setField('name', e.target.value)} />
                  {errors.name && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.name}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">รหัสสินค้า (SKU) *</label>
                  <input type="text" className={`input-field font-mono ${errors.sku ? 'input-error' : ''}`} value={formData.sku || ''} title="รหัสสินค้า (SKU)" placeholder="กรอกรหัสสินค้า (SKU)"
                    onChange={e => setField('sku', e.target.value)} />
                  {errors.sku && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.sku}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">หมวดหมู่ *</label>
                  <input type="text" className={`input-field ${errors.category ? 'input-error' : ''}`} value={formData.category || ''} title="หมวดหมู่" placeholder="กรอกหมวดหมู่"
                    onChange={e => setField('category', e.target.value)} />
                  {errors.category && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.category}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">ราคาต่อหน่วย (บาท) *</label>
                  <input type="number" inputMode="decimal" min={0} step={0.01} className={`input-field text-right ${errors.unitPrice ? 'input-error' : ''}`} value={formData.unitPrice || ''} title="ราคาต่อหน่วย (บาท)" placeholder="0.00"
                    onChange={e => setField('unitPrice', parseFloat(e.target.value) || 0)} />
                  {errors.unitPrice && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.unitPrice}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">หน่วยนับ *</label>
                  <input type="text" className={`input-field ${errors.unit ? 'input-error' : ''}`} value={formData.unit || ''} title="หน่วยนับ" placeholder="กรอกหน่วยนับ"
                    onChange={e => setField('unit', e.target.value)} />
                  {errors.unit && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.unit}</p>}
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
