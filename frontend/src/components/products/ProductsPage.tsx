import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit2, Trash2, Package, X, Save, Download } from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';
import { apiClient } from '../../services/apiClient';
interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  costPrice?: number | null;
  unit: string;
  stockQuantity?: number | null;
  barcode?: string | null;
}

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: keyof Product, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name?.trim()) e.name = t('products.errName');
    if (!formData.sku?.trim()) e.sku = t('products.errSku');
    if (!formData.category?.trim()) e.category = t('products.errCategory');
    if (formData.unitPrice == null || formData.unitPrice <= 0) e.unitPrice = t('products.errUnitPrice');
    if (!formData.unit?.trim()) e.unit = t('products.errUnit');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const loadProducts = useCallback(async (): Promise<Product[]> => {
    const res = await apiClient.get('/products');
    return res.data?.success && res.data?.data?.items ? (res.data.data.items as Product[]) : [];
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const items = await loadProducts();
      setProducts(items);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

  useEffect(() => {
    let active = true;
    loadProducts()
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch((error) => {
        console.error('Error fetching products:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadProducts]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', sku: '', barcode: '', category: t('products.defaultCategory'), unitPrice: 0, costPrice: null, stockQuantity: null, unit: t('products.defaultUnit') });
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
        sku: formData.sku?.trim() || null,
        barcode: formData.barcode?.trim() || null,
        name: formData.name?.trim(),
        category: formData.category?.trim(),
        unitPrice: formData.unitPrice,
        costPrice: formData.costPrice !== undefined && formData.costPrice !== null && String(formData.costPrice) !== '' ? Number(formData.costPrice) : null,
        unit: formData.unit?.trim(),
        description: formData.name?.trim(),
        stockQuantity: formData.stockQuantity !== undefined && formData.stockQuantity !== null ? Number(formData.stockQuantity) : null,
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
      alert(t('products.saveError'));
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('products.confirmDelete'))) {
      try {
        await apiClient.delete(`/products/${id}`);
        await fetchProducts(); // Refresh list from backend
      } catch (error) {
        console.error('Delete failed', error);
        alert(t('products.deleteError'));
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    const mapping = {
      sku: t('products.colSku'),
      name: t('products.colName'),
      category: t('products.colCategory'),
      unitPrice: t('products.colUnitPrice'),
      costPrice: t('products.colCostPrice'),
      unit: t('products.colUnit')
    };
    exportToExcel(filteredProducts, 'Products', mapping);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'th-TH', { minimumFractionDigits: 2 }).format(value);
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">{t('products.title')}</h2>
          <p className="entity-page-subtitle text-sm text-[var(--color-text-muted)]">
            {t('products.countTotal')} <span className="font-semibold text-[var(--color-text-secondary)]">{products.length}</span> {t('products.countUnit')}
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder={t('products.searchPlaceholder')}
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button className="btn btn-secondary flex-1 sm:flex-none" onClick={handleExport}>
            <Download size={16} /> {t('products.exportExcel')}
          </button>
          <button className="btn btn-primary flex-1 sm:flex-none" onClick={() => handleOpenModal()}>
            <Plus size={16} /> {t('products.addBtn')}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table table-responsive">
          <thead>
            <tr>
              <th>{t('products.colSku')}</th>
              <th>{t('products.colName')}</th>
              <th>{t('products.colCategory')}</th>
              <th className="text-right">{t('products.colUnitPrice')}</th>
              <th className="text-right">{t('products.colCostPrice')}</th>
              <th className="text-center">{t('products.colStock')}</th>
              <th>{t('products.colUnit')}</th>
              <th className="w-24 text-center">{t('products.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  {t('products.loading')}
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  {t('products.empty')}
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="animate-fade-in">
                  <td data-label={t('products.colSku')} className="font-mono text-sm">{product.sku}</td>
                  <td data-label={t('products.colName')}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                        <Package size={15} />
                      </div>
                      <span className="font-semibold text-sm">{product.name}</span>
                    </div>
                  </td>
                  <td data-label={t('products.colCategory')}><span className="badge badge-info">{product.category}</span></td>
                  <td data-label={t('products.colUnitPrice')} className="text-right font-semibold tabular-nums">฿{formatCurrency(product.unitPrice)}</td>
                  <td data-label={t('products.colCostPrice')} className="text-right tabular-nums text-[var(--color-text-muted)]">
                    {product.costPrice !== null && product.costPrice !== undefined
                      ? `฿${formatCurrency(product.costPrice)}`
                      : '-'}
                  </td>
                  <td data-label={t('products.colStock')} className="text-center tabular-nums">
                    {product.stockQuantity !== null && product.stockQuantity !== undefined 
                      ? product.stockQuantity 
                      : '-'}
                  </td>
                  <td data-label={t('products.colUnit')}><span className="text-sm text-[var(--color-text-secondary)]">{product.unit}</span></td>
                  <td data-label={t('products.colActions')}>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => handleOpenModal(product)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors" title={t('products.editTitle')} aria-label={`${t('products.editTitle')} ${product.name}`}>
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(product.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors" title={t('products.deleteTitle')} aria-label={`${t('products.deleteTitle')} ${product.name}`}>
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
              <h3 className="font-bold text-lg">{editingProduct ? t('products.modalEditTitle') : t('products.modalAddTitle')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title={t('documentsList.closeWindow')} aria-label={t('documentsList.closeWindow')}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} noValidate className="form-modal-content form-stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldName')}</label>
                  <input type="text" className={`input-field ${errors.name ? 'input-error' : ''}`} value={formData.name || ''} title={t('products.fieldName')} placeholder={t('products.fieldName')}
                    onChange={e => setField('name', e.target.value)} />
                  {errors.name && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.name}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldSku')}</label>
                  <input type="text" className={`input-field font-mono ${errors.sku ? 'input-error' : ''}`} value={formData.sku || ''} title={t('products.fieldSku')} placeholder={t('products.fieldSku')}
                    onChange={e => setField('sku', e.target.value)} />
                  {errors.sku && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.sku}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldBarcode')}</label>
                  <input type="text" className={`input-field font-mono ${errors.barcode ? 'input-error' : ''}`} value={formData.barcode || ''} title={t('products.fieldBarcode')} placeholder={t('products.fieldBarcode')}
                    onChange={e => setField('barcode', e.target.value)} />
                  {errors.barcode && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.barcode}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldCategory')}</label>
                  <input type="text" className={`input-field ${errors.category ? 'input-error' : ''}`} value={formData.category || ''} title={t('products.fieldCategory')} placeholder={t('products.fieldCategory')}
                    onChange={e => setField('category', e.target.value)} />
                  {errors.category && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.category}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldUnitPrice')}</label>
                  <input type="number" inputMode="decimal" min={0} step={0.01} className={`input-field text-right ${errors.unitPrice ? 'input-error' : ''}`} value={formData.unitPrice || ''} title={t('products.fieldUnitPrice')} placeholder="0.00"
                    onChange={e => setField('unitPrice', parseFloat(e.target.value) || 0)} />
                  {errors.unitPrice && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.unitPrice}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldCostPrice')}</label>
                  <input type="number" inputMode="decimal" min={0} step={0.01} className="input-field text-right" value={formData.costPrice ?? ''} title={t('products.fieldCostPrice')} placeholder="0.00"
                    onChange={e => setField('costPrice', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldStock')}</label>
                  <input type="number" inputMode="decimal" step={0.01} className={`input-field text-right ${errors.stockQuantity ? 'input-error' : ''}`} value={formData.stockQuantity ?? ''} title={t('products.fieldStock')} placeholder="0"
                    onChange={e => setField('stockQuantity', e.target.value === '' ? null : parseFloat(e.target.value))} />
                  {errors.stockQuantity && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.stockQuantity}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('products.fieldUnit')}</label>
                  <input type="text" className={`input-field ${errors.unit ? 'input-error' : ''}`} value={formData.unit || ''} title={t('products.fieldUnit')} placeholder={t('products.fieldUnit')}
                    onChange={e => setField('unit', e.target.value)} />
                  {errors.unit && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.unit}</p>}
                </div>
              </div>
              
              <div className="form-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">{t('products.cancel')}</button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  <Save size={16} /> {isSaving ? t('products.saving') : t('products.save')}
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
