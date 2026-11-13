import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Warehouse, Plus, ArrowRightLeft, SlidersHorizontal, History, AlertTriangle, X, Save, Edit2 } from 'lucide-react';
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
            <h2 className="text-lg font-bold text-[var(--color-text)]">คลังสินค้าหลายสาขา (Multi-Warehouse &amp; Stock Ledger)</h2>
            <p className="text-sm text-[var(--color-text-muted)]">ตรวจสอบสต็อกแยกคลัง โอนย้ายสินค้าระหว่างสาขา ปรับยอดตรวจนับ และดู Stock Card</p>
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
            <SlidersHorizontal size={14} /> ปรับยอดสต็อก
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
            <ArrowRightLeft size={14} /> โอนย้ายระหว่างคลัง
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
            <Plus size={16} /> เพิ่มคลังสินค้า
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
                {w.isDefault && <span className="badge badge-success text-[10px]">คลังหลัก</span>}
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
                  title="แก้ไขข้อมูลคลัง"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-sm mt-1 flex items-center gap-1.5"><Warehouse size={15} /> {w.name}</h4>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              {w.productCount} รายการ • คงเหลือ {w.totalUnits.toLocaleString('th-TH')} หน่วย
            </p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab('stocks')} className={`btn text-xs ${tab === 'stocks' ? 'btn-primary' : 'btn-secondary'}`}>
            สต็อกคงเหลือแยกคลัง ({stocks.length})
          </button>
          <button type="button" onClick={() => setTab('movements')} className={`btn text-xs ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}>
            <History size={14} /> ประวัติความเคลื่อนไหว ({movements.length})
          </button>
        </div>
        {tab === 'stocks' && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            แสดงเฉพาะสินค้าต่ำกว่าจุดสั่งซื้อ (Low Stock)
          </label>
        )}
      </div>

      {tab === 'stocks' ? (
        <div className="card overflow-hidden">
          <table className="data-table table-responsive">
            <thead>
              <tr>
                <th>คลังสินค้า</th>
                <th>SKU</th>
                <th>สินค้า</th>
                <th className="text-right">คงเหลือ</th>
                <th className="text-right">จุดสั่งซื้อ</th>
                <th className="text-center">สถานะ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">ยังไม่มีข้อมูลสต็อกแยกคลัง</td></tr>
              ) : (
                stocks.map((s) => (
                  <tr key={`${s.warehouseId}-${s.productId}`}>
                    <td className="text-sm font-medium">{s.warehouseName} ({s.warehouseCode})</td>
                    <td className="font-mono text-xs">{s.sku || '-'}</td>
                    <td className="text-sm">{s.productName}</td>
                    <td className="text-right font-mono font-bold text-sm">{s.quantity.toLocaleString('th-TH')} {s.unit}</td>
                    <td className="text-right font-mono text-xs text-[var(--color-text-muted)]">{s.reorderLevel.toLocaleString('th-TH')}</td>
                    <td className="text-center">
                      {s.isLowStock ? (
                        <span className="badge badge-danger inline-flex items-center gap-1 text-[10px]">
                          <AlertTriangle size={12} /> ใกล้หมด
                        </span>
                      ) : (
                        <span className="badge badge-success text-[10px]">ปกติ</span>
                      )}
                    </td>
                    <td>
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
                          title="ปรับยอด / ตั้งจุดสั่งซื้อ"
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
                          title="โอนย้ายไปคลังอื่น"
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
                <th>วันที่/เวลา</th>
                <th>คลัง</th>
                <th>สินค้า</th>
                <th>ประเภท</th>
                <th className="text-right">เปลี่ยนแปลง</th>
                <th className="text-right">คงเหลือหลังทำรายการ</th>
                <th>อ้างอิง / หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">ยังไม่มีความเคลื่อนไหวสต็อก</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs">{new Date(m.createdAt).toLocaleString('th-TH')}</td>
                    <td className="text-sm">{m.warehouseName}</td>
                    <td className="text-sm font-medium">{m.productName}</td>
                    <td><span className="badge badge-info text-[10px]">{m.movementType}</span></td>
                    <td className={`text-right font-mono font-bold text-sm ${m.quantityDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="text-right font-mono text-sm">{m.balanceAfter}</td>
                    <td className="text-xs text-[var(--color-text-muted)]">{[m.referenceNumber, m.notes].filter(Boolean).join(' • ') || '-'}</td>
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
                <h3 className="font-bold">{editingWhId ? 'แก้ไขคลังสินค้า / สาขา' : 'เพิ่มคลังสินค้า / สาขา'}</h3>
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
                    alert(getApiError(err, 'ไม่สามารถบันทึกคลังสินค้าได้'));
                  }
                }}
                className="space-y-3"
              >
                <input required className="input-field font-mono" placeholder="รหัสคลัง เช่น WH-BKK2" value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} />
                <input required className="input-field" placeholder="ชื่อคลัง เช่น สาขาพระราม 9" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
                <input className="input-field" placeholder="ที่อยู่ (ถ้ามี)" value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={whForm.isDefault} onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })} />
                  ตั้งเป็นคลังสินค้าหลัก (Default)
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setWhModal(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary"><Save size={15} /> บันทึก</button>
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
                <h3 className="font-bold">โอนย้ายสินค้าระหว่างคลัง</h3>
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
                    alert(getApiError(err, 'ไม่สามารถโอนย้ายสินค้าได้'));
                  }
                }}
                className="space-y-3"
              >
                <select required className="input-field" value={trfForm.productId} onChange={(e) => setTrfForm({ ...trfForm, productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select required className="input-field" value={trfForm.fromWarehouseId} onChange={(e) => setTrfForm({ ...trfForm, fromWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>จาก: {w.name}</option>)}
                </select>
                <select required className="input-field" value={trfForm.toWarehouseId} onChange={(e) => setTrfForm({ ...trfForm, toWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>ไปยัง: {w.name}</option>)}
                </select>
                <input required type="number" min="0.01" step="0.01" className="input-field" placeholder="จำนวน" value={trfForm.quantity} onChange={(e) => setTrfForm({ ...trfForm, quantity: Number(e.target.value) })} />
                <input className="input-field" placeholder="หมายเหตุ" value={trfForm.notes} onChange={(e) => setTrfForm({ ...trfForm, notes: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setTrfModal(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary">ยืนยันโอนย้าย</button>
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
                <h3 className="font-bold">ปรับปรุงยอดสต็อก (Stock Adjustment)</h3>
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
                    alert(getApiError(err, 'ไม่สามารถปรับยอดสต็อกได้'));
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
                <input required type="number" min="0" step="0.01" className="input-field" placeholder="จำนวนตรวจนับจริง" value={adjForm.newQuantity} onChange={(e) => setAdjForm({ ...adjForm, newQuantity: Number(e.target.value) })} />
                <input type="number" min="0" step="1" className="input-field" placeholder="จุดแจ้งเตือนสั่งซื้อ (Reorder Level)" value={adjForm.reorderLevel} onChange={(e) => setAdjForm({ ...adjForm, reorderLevel: Number(e.target.value) })} />
                <input className="input-field" placeholder="เหตุผลการปรับยอด" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAdjModal(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary">บันทึกยอดใหม่</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

