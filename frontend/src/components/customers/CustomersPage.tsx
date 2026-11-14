import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit2, Trash2, MapPin, Phone, X, Save, Download, History, Printer } from 'lucide-react';
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

interface PurchaseHistoryDto {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchaseDate: string | null;
  recentDocuments: Array<{
    id: string;
    documentNumber: string;
    documentType: string;
    documentDate: string;
    grandTotal: number;
    status: string;
  }>;
}

export default function CustomersPage() {
  const { t, i18n } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyData, setHistoryData] = useState<PurchaseHistoryDto | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
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
    if (!formData.name?.trim()) e.name = t('customers.errName');
    if (!formData.branch?.trim()) e.branch = t('customers.errBranch');
    if (!formData.taxId?.trim()) e.taxId = t('customers.errTaxIdRequired');
    else if (!/^\d{13}$/.test(formData.taxId.trim())) e.taxId = t('customers.errTaxIdDigits');
    if (!formData.address?.trim()) e.address = t('customers.errAddress');
    if (formData.phone?.trim() && !/^[0-9+\-\s()]{6,}$/.test(formData.phone.trim())) e.phone = t('customers.errPhone');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const loadCustomers = useCallback(async (): Promise<Customer[]> => {
    const res = await apiClient.get('/customers');
    return res.data?.success && res.data?.data?.items ? (res.data.data.items as Customer[]) : [];
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const items = await loadCustomers();
      setCustomers(items);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [loadCustomers]);

  useEffect(() => {
    let active = true;
    loadCustomers()
      .then((items) => {
        if (active) setCustomers(items);
      })
      .catch((error) => {
        console.error('Error fetching customers:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCustomers]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', branch: t('customers.defaultBranch'), taxId: '', address: '', phone: '' });
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
      alert(t('customers.saveError'));
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('customers.confirmDelete'))) {
      try {
        await apiClient.delete(`/customers/${id}`);
        await fetchCustomers();
      } catch (error) {
        console.error('Delete failed', error);
        alert(t('customers.deleteError'));
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.taxId.includes(search)
  );

  const handleExport = () => {
    const mapping = {
      name: t('customers.colName'),
      branch: t('customers.colBranch'),
      taxId: t('customers.colTaxId'),
      address: t('customers.fieldAddress'),
      phone: t('customers.fieldPhone')
    };
    exportToExcel(filteredCustomers, 'Customers', mapping);
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">{t('customers.title')}</h2>
          <p className="entity-page-subtitle text-sm text-[var(--color-text-muted)]">
            {t('customers.countTotal')} <span className="font-semibold text-[var(--color-text-secondary)]">{customers.length}</span> {t('customers.countUnit')}
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder={t('customers.searchPlaceholder')}
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button className="btn btn-secondary flex-1 sm:flex-none" onClick={handleExport}>
            <Download size={16} /> {t('customers.exportExcel')}
          </button>
          <button className="btn btn-primary flex-1 sm:flex-none" onClick={() => handleOpenModal()}>
            <Plus size={16} /> {t('customers.addBtn')}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table table-responsive">
          <thead>
            <tr>
              <th>{t('customers.colName')}</th>
              <th>{t('customers.colBranch')}</th>
              <th>{t('customers.colTaxId')}</th>
              <th>{t('customers.colContact')}</th>
              <th className="w-24 text-center">{t('customers.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  {t('customers.loading')}
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-state-cell text-center text-sm text-[var(--color-text-muted)]">
                  {t('customers.empty')}
                </td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className="animate-fade-in">
                  <td data-label={t('customers.colName')}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                        {getInitial(customer.name)}
                      </div>
                      <span className="font-semibold text-sm">{customer.name}</span>
                    </div>
                  </td>
                  <td data-label={t('customers.colBranch')}><span className="badge badge-neutral">{customer.branch}</span></td>
                  <td data-label={t('customers.colTaxId')} className="font-mono text-sm">{customer.taxId}</td>
                  <td data-label={t('customers.colContact')}>
                    <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                      <span className="flex items-center gap-1 truncate max-w-[200px]" title={customer.address}>
                        <MapPin size={12} /> {customer.address}
                      </span>
                    </div>
                  </td>
                  <td data-label={t('customers.colActions')}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoadingHistory(true);
                          setHistoryData({
                            customerId: customer.id,
                            customerName: customer.name,
                            totalOrders: 0,
                            totalSpent: 0,
                            lastPurchaseDate: null,
                            recentDocuments: [],
                          });
                          apiClient
                            .get(`/customers/${customer.id}/purchase-history?recentDocsCount=10`)
                            .then((res) => {
                              if (res.data?.success && res.data?.data) {
                                setHistoryData(res.data.data as PurchaseHistoryDto);
                              }
                            })
                            .catch((err) => {
                              console.error('Failed to load purchase history', err);
                            })
                            .finally(() => {
                              setLoadingHistory(false);
                            });
                        }}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-indigo-600 transition-colors"
                        title={t('customers.historyTitle')}
                        aria-label={`${t('customers.historyTitle')} ${customer.name}`}
                      >
                        <History size={16} />
                      </button>
                      <button type="button" onClick={() => handleOpenModal(customer)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors" title={t('customers.editTitle')} aria-label={`${t('customers.editTitle')} ${customer.name}`}>
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(customer.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors" title={t('customers.deleteTitle')} aria-label={`${t('customers.deleteTitle')} ${customer.name}`}>
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
              <h3 className="font-bold text-lg">{editingCustomer ? t('customers.modalEditTitle') : t('customers.modalAddTitle')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title={t('documentsList.closeWindow')} aria-label={t('documentsList.closeWindow')}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} noValidate className="form-modal-content form-stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">{t('customers.fieldName')}</label>
                  <input type="text" className={`input-field ${errors.name ? 'input-error' : ''}`} value={formData.name || ''} title={t('customers.fieldName')} placeholder={t('customers.fieldName')}
                    onChange={e => setField('name', e.target.value)} />
                  {errors.name && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.name}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('customers.fieldBranch')}</label>
                  <input type="text" className={`input-field ${errors.branch ? 'input-error' : ''}`} value={formData.branch || ''} title={t('customers.fieldBranch')} placeholder={t('customers.fieldBranch')}
                    onChange={e => setField('branch', e.target.value)} />
                  {errors.branch && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.branch}</p>}
                </div>

                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">{t('customers.fieldTaxId')}</label>
                  <input type="text" inputMode="numeric" maxLength={13} className={`input-field font-mono ${errors.taxId ? 'input-error' : ''}`} value={formData.taxId || ''} title={t('customers.fieldTaxId')} placeholder="13 digits"
                    onChange={e => setField('taxId', e.target.value.replace(/\D/g, ''))} />
                  {errors.taxId && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.taxId}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">{t('customers.fieldAddress')}</label>
                  <input type="text" className={`input-field ${errors.address ? 'input-error' : ''}`} value={formData.address || ''} title={t('customers.fieldAddress')} placeholder={t('customers.fieldAddress')}
                    onChange={e => setField('address', e.target.value)} />
                  {errors.address && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.address}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="layout-form-label-sm block text-sm font-medium">{t('customers.fieldPhone')}</label>
                  <input type="text" inputMode="tel" className={`input-field ${errors.phone ? 'input-error' : ''}`} value={formData.phone || ''} title={t('customers.fieldPhone')} placeholder="02-123-4567"
                    onChange={e => setField('phone', e.target.value)} />
                  {errors.phone && <p className="text-xs mt-1 text-[var(--color-danger)]">{errors.phone}</p>}
                </div>
              </div>
              
              <div className="form-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">{t('customers.cancel')}</button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  <Save size={16} /> {isSaving ? t('customers.saving') : t('customers.save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {historyData && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="rounded-2xl shadow-xl w-full max-w-2xl border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)]">
            <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-lg">{t('customers.historyModalTitle')}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{historyData.customerName}</p>
              </div>
              <button type="button" onClick={() => setHistoryData(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label={t('documentsList.closeWindow')}>
                <X size={20} />
              </button>
            </div>
            <div className="form-modal-content form-stack-md">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('customers.historyTotalBills')}</p>
                  <p className="text-lg font-bold mt-1">{loadingHistory ? '...' : `${historyData.totalOrders} ${t('customers.historyBillsUnit')}`}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('customers.historyTotalSpent')}</p>
                  <p className="text-lg font-bold text-[var(--color-primary)] mt-1">
                    {loadingHistory ? '...' : `฿${historyData.totalSpent.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('customers.historyLastPurchase')}</p>
                  <p className="text-sm font-semibold mt-1">
                    {loadingHistory ? '...' : historyData.lastPurchaseDate ? new Date(historyData.lastPurchaseDate).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'th-TH') : '-'}
                  </p>
                </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t('customers.historyColDate')}</th>
                      <th>{t('customers.historyColDocNo')}</th>
                      <th>{t('customers.historyColType')}</th>
                      <th className="text-right">{t('customers.historyColTotal')}</th>
                      <th className="text-right">{t('customers.historyColPrint')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr><td colSpan={5} className="text-center py-6 text-[var(--color-text-muted)]">{t('customers.historyLoading')}</td></tr>
                    ) : historyData.recentDocuments.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-[var(--color-text-muted)]">{t('customers.historyEmpty')}</td></tr>
                    ) : (
                      historyData.recentDocuments.map((doc) => (
                        <tr key={doc.id}>
                          <td>{new Date(doc.documentDate).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'th-TH')}</td>
                          <td className="font-mono font-semibold text-[var(--color-primary)]">{doc.documentNumber}</td>
                          <td>{doc.documentType}</td>
                          <td className="text-right tabular-nums font-medium">
                            {doc.documentType === 'CreditNote' ? '-' : ''}฿{doc.grandTotal.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                              title={t('customers.historyColPrint')}
                            >
                              <Printer size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
