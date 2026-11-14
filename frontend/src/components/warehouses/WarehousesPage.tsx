import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Warehouse, Plus, ArrowRightLeft, SlidersHorizontal, History, AlertTriangle, X, Save, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';

const getApiError = (err: unknown, fallback: string) =>
  typeof err === 'object' && err !== null && 'response' in err
    ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback)
    : fallback;

interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isDefault: boolean;
  productCount: number;
  totalUnits: number;
}

interface StockItemDto {
  productId: string;
  sku?: string | null;
  productName: string;
  unit: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  reorderLevel: number;
  isLowStock: boolean;
}

interface MovementDto {
  id: string;
  productName: string;
  warehouseName: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface ProductDto {
  id: string;
  name: string;
  unit: string;
}

export default function WarehousesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const [tab, setTab] = useState<'stocks' | 'movements'>('stocks');
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [stocks, setStocks] = useState<StockItemDto[]>([]);
  const [movements, setMovements] = useState<MovementDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [selectedWh, setSelectedWh] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [whModal, setWhModal] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whForm, setWhForm] = useState({ code: '', name: '', address: '', isDefault: false });

  const [trfModal, setTrfModal] = useState(false);
  const [trfForm, setTrfForm] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 1, notes: '' });

  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ productId: '', warehouseId: '', newQuantity: 0, reorderLevel: 5, notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const [whRes, stRes, mvRes, prRes] = await Promise.all([
        apiClient.get('/warehouses'),
        apiClient.get(`/warehouses/stocks?${selectedWh ? `warehouseId=${selectedWh}&` : ''}lowStockOnly=${lowStockOnly}`),
        apiClient.get(`/warehouses/movements${selectedWh ? `?warehouseId=${selectedWh}` : ''}`),
        apiClient.get('/products?pageSize=200'),
      ]);
      setWarehouses(whRes.data?.data ?? []);
      setStocks(stRes.data?.data ?? []);
      setMovements(mvRes.data?.data ?? []);
      setProducts(prRes.data?.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  }, [selectedWh, lowStockOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  return (
    <div className="page-stack">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">{t('warehouses.title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t('warehouses.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAdjForm({
                productId: products[0]?.id || '',
                warehouseId: warehouses[0]?.id || '',
                newQuantity: 0,
                reorderLevel: 5,
                notes: '',
              });
              setAdjModal(true);
            }}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <SlidersHorizontal size={14} /> {t('warehouses.adjustBtn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTrfForm({
                productId: products[0]?.id || '',
                fromWarehouseId: warehouses[0]?.id || '',
                toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || '',
                quantity: 1,
                notes: '',
              });
              setTrfModal(true);
            }}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <ArrowRightLeft size={14} /> {t('warehouses.transferBtn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingWhId(null);
              setWhForm({ code: '', name: '', address: '', isDefault: false });
              setWhModal(true);
            }}
            className="btn btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} /> {t('warehouses.addWarehouseBtn')}
          </button>
        </div>
      </div>

      {/* Warehouse cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {warehouses.map((w) => (
          <div
            key={w.id}
            onClick={() => setSelectedWh(selectedWh === w.id ? '' : w.id)}
            className={`card p-4 cursor-pointer transition-all ${selectedWh === w.id ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">{w.code}</span>
              <div className="flex items-center gap-1.5">
                {w.isDefault && <span className="badge badge-success text-[10px]">{t('warehouses.defaultBadge')}</span>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingWhId(w.id);
                    setWhForm({
                      code: w.code,
                      name: w.name,
                      address: w.address ?? '',
                      isDefault: w.isDefault,
                    });
                    setWhModal(true);
                  }}
                  className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  title={t('warehouses.editWarehouseTitle')}
                >
                  <Edit2 size={13} />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-sm mt-1 flex items-center gap-1.5"><Warehouse size={15} /> {w.name}</h4>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              {t('warehouses.summaryStats', { count: w.productCount, units: w.totalUnits.toLocaleString(locale) })}
            </p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab('stocks')} className={`btn text-xs ${tab === 'stocks' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('warehouses.tabStocks', { count: stocks.length })}
          </button>
          <button type="button" onClick={() => setTab('movements')} className={`btn text-xs ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}>
            <History size={14} /> {t('warehouses.tabMovements', { count: movements.length })}
          </button>
        </div>
        {tab === 'stocks' && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            {t('warehouses.lowStockFilter')}
          </label>
        )}
      </div>

      {tab === 'stocks' ? (
        <div className="card overflow-hidden">
          <table className="data-table table-responsive">
            <thead>
              <tr>
                <th>{t('warehouses.colWarehouse')}</th>
                <th>{t('warehouses.colSku')}</th>
                <th>{t('warehouses.colProduct')}</th>
                <th className="text-right">{t('warehouses.colRemaining')}</th>
                <th className="text-right">{t('warehouses.colReorderLevel')}</th>
                <th className="text-center">{t('warehouses.colStatus')}</th>
                <th className="text-center">{t('warehouses.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">{t('warehouses.emptyStocks')}</td></tr>
              ) : (
                stocks.map((s) => (
                  <tr key={`${s.warehouseId}-${s.productId}`}>
                    <td data-label={t('warehouses.colWarehouse')} className="text-sm font-medium">{s.warehouseName} ({s.warehouseCode})</td>
                    <td data-label={t('warehouses.colSku')} className="font-mono text-xs">{s.sku || '-'}</td>
                    <td data-label={t('warehouses.colProduct')} className="text-sm">{s.productName}</td>
                    <td data-label={t('warehouses.colRemaining')} className="text-right font-mono font-bold text-sm">{s.quantity.toLocaleString(locale)} {s.unit}</td>
                    <td data-label={t('warehouses.colReorderLevel')} className="text-right font-mono text-xs text-[var(--color-text-muted)]">{s.reorderLevel.toLocaleString(locale)}</td>
                    <td data-label={t('warehouses.colStatus')} className="text-center">
                      {s.isLowStock ? (
                        <span className="badge badge-danger inline-flex items-center gap-1 text-[10px]">
                          <AlertTriangle size={12} /> {t('warehouses.lowStockBadge')}
                        </span>
                      ) : (
                        <span className="badge badge-success text-[10px]">{t('warehouses.normalBadge')}</span>
                      )}
                    </td>
                    <td data-label={t('warehouses.colActions')}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjForm({
                              productId: s.productId,
                              warehouseId: s.warehouseId,
                              newQuantity: s.quantity,
                              reorderLevel: s.reorderLevel,
                              notes: '',
                            });
                            setAdjModal(true);
                          }}
                          className="p-1.5 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                          title={t('warehouses.rowAdjustTitle')}
                        >
                          <SlidersHorizontal size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const otherWh = warehouses.find((w) => w.id !== s.warehouseId)?.id || s.warehouseId;
                            setTrfForm({
                              productId: s.productId,
                              fromWarehouseId: s.warehouseId,
                              toWarehouseId: otherWh,
                              quantity: 1,
                              notes: '',
                            });
                            setTrfModal(true);
                          }}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                          title={t('warehouses.rowTransferTitle')}
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table table-responsive">
            <thead>
              <tr>
                <th>{t('warehouses.colDateTime')}</th>
                <th>{t('warehouses.colWhShort')}</th>
                <th>{t('warehouses.colProduct')}</th>
                <th>{t('warehouses.colType')}</th>
                <th className="text-right">{t('warehouses.colDelta')}</th>
                <th className="text-right">{t('warehouses.colBalanceAfter')}</th>
                <th>{t('warehouses.colRefNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">{t('warehouses.emptyMovements')}</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td data-label={t('warehouses.colDateTime')} className="text-xs">{new Date(m.createdAt).toLocaleString(locale)}</td>
                    <td data-label={t('warehouses.colWhShort')} className="text-sm">{m.warehouseName}</td>
                    <td data-label={t('warehouses.colProduct')} className="text-sm font-medium">{m.productName}</td>
                    <td data-label={t('warehouses.colType')}><span className="badge badge-info text-[10px]">{m.movementType}</span></td>
                    <td data-label={t('warehouses.colDelta')} className={`text-right font-mono font-bold text-sm ${m.quantityDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td data-label={t('warehouses.colBalanceAfter')} className="text-right font-mono text-sm">{m.balanceAfter}</td>
                    <td data-label={t('warehouses.colRefNotes')} className="text-xs text-[var(--color-text-muted)]">{[m.referenceNumber, m.notes].filter(Boolean).join(' • ') || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Warehouse Modal */}
      {whModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold">{editingWhId ? t('warehouses.modalEditWh') : t('warehouses.modalAddWh')}</h3>
                <button type="button" onClick={() => setWhModal(false)}><X size={18} /></button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (editingWhId) {
                      await apiClient.put(`/warehouses/${editingWhId}`, whForm);
                    } else {
                      await apiClient.post('/warehouses', whForm);
                    }
                    setWhModal(false);
                    setEditingWhId(null);
                    setWhForm({ code: '', name: '', address: '', isDefault: false });
                    await fetchData();
                  } catch (err: unknown) {
                    alert(getApiError(err, t('warehouses.saveWhError')));
                  }
                }}
                className="space-y-3"
              >
                <input required className="input-field font-mono" placeholder={t('warehouses.whCodePlaceholder')} value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} />
                <input required className="input-field" placeholder={t('warehouses.whNamePlaceholder')} value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
                <input className="input-field" placeholder={t('warehouses.whAddressPlaceholder')} value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={whForm.isDefault} onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })} />
                  {t('warehouses.setDefaultLabel')}
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setWhModal(false)} className="btn btn-secondary">{t('warehouses.cancel')}</button>
                  <button type="submit" className="btn btn-primary"><Save size={15} /> {t('warehouses.save')}</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Transfer Modal */}
      {trfModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold">{t('warehouses.modalTransferTitle')}</h3>
                <button type="button" onClick={() => setTrfModal(false)}><X size={18} /></button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiClient.post('/warehouses/transfer', trfForm);
                    setTrfModal(false);
                    await fetchData();
                  } catch (err: unknown) {
                    alert(getApiError(err, t('warehouses.transferError')));
                  }
                }}
                className="space-y-3"
              >
                <select required className="input-field" value={trfForm.productId} onChange={(e) => setTrfForm({ ...trfForm, productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select required className="input-field" value={trfForm.fromWarehouseId} onChange={(e) => setTrfForm({ ...trfForm, fromWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{t('warehouses.fromPrefix')} {w.name}</option>)}
                </select>
                <select required className="input-field" value={trfForm.toWarehouseId} onChange={(e) => setTrfForm({ ...trfForm, toWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{t('warehouses.toPrefix')} {w.name}</option>)}
                </select>
                <input required type="number" min="0.01" step="0.01" className="input-field" placeholder={t('warehouses.qtyPlaceholder')} value={trfForm.quantity} onChange={(e) => setTrfForm({ ...trfForm, quantity: Number(e.target.value) })} />
                <input className="input-field" placeholder={t('warehouses.notesPlaceholder')} value={trfForm.notes} onChange={(e) => setTrfForm({ ...trfForm, notes: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setTrfModal(false)} className="btn btn-secondary">{t('warehouses.cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('warehouses.confirmTransfer')}</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Adjust Modal */}
      {adjModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold">{t('warehouses.modalAdjustTitle')}</h3>
                <button type="button" onClick={() => setAdjModal(false)}><X size={18} /></button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiClient.post('/warehouses/adjust', adjForm);
                    setAdjModal(false);
                    await fetchData();
                  } catch (err: unknown) {
                    alert(getApiError(err, t('warehouses.adjustError')));
                  }
                }}
                className="space-y-3"
              >
                <select required className="input-field" value={adjForm.productId} onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select required className="input-field" value={adjForm.warehouseId} onChange={(e) => setAdjForm({ ...adjForm, warehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input required type="number" min="0" step="0.01" className="input-field" placeholder={t('warehouses.countedQtyPlaceholder')} value={adjForm.newQuantity} onChange={(e) => setAdjForm({ ...adjForm, newQuantity: Number(e.target.value) })} />
                <input type="number" min="0" step="1" className="input-field" placeholder={t('warehouses.reorderPlaceholder')} value={adjForm.reorderLevel} onChange={(e) => setAdjForm({ ...adjForm, reorderLevel: Number(e.target.value) })} />
                <input className="input-field" placeholder={t('warehouses.adjustReasonPlaceholder')} value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAdjModal(false)} className="btn btn-secondary">{t('warehouses.cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('warehouses.saveNewBalance')}</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

