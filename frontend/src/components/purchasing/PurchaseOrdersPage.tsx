import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag, Plus, Building, PackageCheck, FileText, Ban, X, Save, Trash2, Search, Edit2
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface VendorDto {
  id: string;
  name: string;
  taxId?: string | null;
  branch?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  paymentTermsDays: number;
  defaultWhtRate: number;
  defaultPndType: 'None' | 'PND3' | 'PND53';
}

const getApiError = (err: unknown, fallback: string) =>
  typeof err === 'object' && err !== null && 'response' in err
    ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback)
    : fallback;

interface ProductDto {
  id: string;
  sku?: string | null;
  name: string;
  unit: string;
  unitPrice: number;
}

interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
}

interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  vendorId?: string | null;
  vendorName: string;
  vendorTaxId?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  totalBeforeVat: number;
  vatAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'PartiallyReceived' | 'Received' | 'Cancelled';
  linkedExpenseId?: string | null;
  lines: Array<{
    id: string;
    description: string;
    unit: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  Draft: { label: 'ฉบับร่าง', cls: 'badge-info' },
  Sent: { label: 'สั่งซื้อแล้ว', cls: 'badge-warning' },
  PartiallyReceived: { label: 'รับบางส่วน', cls: 'badge-info' },
  Received: { label: 'รับครบแล้ว', cls: 'badge-success' },
  Cancelled: { label: 'ยกเลิก', cls: 'badge-danger' },
};

const formatCurrency = (v: number) =>
  `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PurchaseOrdersPage() {
  const [tab, setTab] = useState<'po' | 'vendors'>('po');
  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // PO Modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: '',
    vendorId: '',
    vendorName: '',
    vendorTaxId: '',
    vendorBranch: '00000',
    vendorAddress: '',
    warehouseId: '',
    vatMode: 'Exclusive' as 'Exclusive' | 'Inclusive',
    vatRate: 7,
    notes: '',
    lines: [{ productId: '', description: '', unit: 'ชิ้น', quantity: 1, unitPrice: 0, discountAmount: 0 }],
  });

  // Vendor Modal
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    taxId: '',
    branch: '00000',
    address: '',
    phone: '',
    email: '',
    contactPerson: '',
    paymentTermsDays: 30,
    defaultWhtRate: 0,
    defaultPndType: 'None' as 'None' | 'PND3' | 'PND53',
  });

  // Receive PO Modal
  const [receiveModalPo, setReceiveModalPo] = useState<PurchaseOrderDto | null>(null);
  const [receiveForm, setReceiveForm] = useState<{
    warehouseId: string;
    createExpenseRecord: boolean;
    vendorTaxInvoiceNumber: string;
    vendorTaxInvoiceDate: string;
    whtRate: number;
    pndType: 'None' | 'PND3' | 'PND53';
    lines: Array<{ lineId: string; description: string; unit: string; ordered: number; received: number; receiveQuantity: number }>;
  }>({
    warehouseId: '',
    createExpenseRecord: true,
    vendorTaxInvoiceNumber: '',
    vendorTaxInvoiceDate: new Date().toISOString().slice(0, 10),
    whtRate: 0,
    pndType: 'None',
    lines: [],
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [poRes, venRes, prodRes, whRes] = await Promise.all([
        apiClient.get(`/purchase-orders${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        apiClient.get(`/vendors${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        apiClient.get('/products?pageSize=200'),
        apiClient.get('/warehouses'),
      ]);
      setOrders(poRes.data?.data ?? []);
      setVendors(venRes.data?.data ?? []);
      setProducts(prodRes.data?.data?.items ?? []);
      setWarehouses(whRes.data?.data ?? []);
    } catch (err) {
      console.error('Failed to load purchasing data:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAll]);

  const handleSelectVendor = (vendorId: string) => {
    const v = vendors.find((x) => x.id === vendorId);
    setPoForm((prev) => ({
      ...prev,
      vendorId,
      vendorName: v?.name || prev.vendorName,
      vendorTaxId: v?.taxId || '',
      vendorBranch: v?.branch || '00000',
      vendorAddress: v?.address || '',
    }));
  };

  const handleSelectProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setPoForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = {
        ...lines[idx],
        productId,
        description: p?.name || lines[idx].description,
        unit: p?.unit || 'ชิ้น',
        unitPrice: p?.unitPrice || lines[idx].unitPrice,
      };
      return { ...prev, lines };
    });
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/purchase-orders', {
        orderDate: poForm.orderDate,
        expectedDeliveryDate: poForm.expectedDeliveryDate || null,
        vendorId: poForm.vendorId || null,
        vendorName: poForm.vendorName,
        vendorTaxId: poForm.vendorTaxId || null,
        vendorBranch: poForm.vendorBranch || '00000',
        vendorAddress: poForm.vendorAddress || null,
        warehouseId: poForm.warehouseId || null,
        vatMode: poForm.vatMode,
        discountAmount: 0,
        vatRate: poForm.vatRate,
        notes: poForm.notes || null,
        lines: poForm.lines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          unit: l.unit,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount) || 0,
        })),
      });
      setPoModalOpen(false);
      await fetchAll();
    } catch (err: unknown) {
      alert(getApiError(err, 'ไม่สามารถสร้างใบสั่งซื้อได้'));
    }
  };

  const openReceiveModal = (po: PurchaseOrderDto) => {
    const linkedVendor = po.vendorId ? vendors.find((v) => v.id === po.vendorId) : undefined;
    const defaultWh = po.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '';
    setReceiveForm({
      warehouseId: defaultWh,
      createExpenseRecord: true,
      vendorTaxInvoiceNumber: '',
      vendorTaxInvoiceDate: new Date().toISOString().slice(0, 10),
      whtRate: linkedVendor?.defaultWhtRate ?? 0,
      pndType: linkedVendor?.defaultPndType ?? 'None',
      lines: po.lines.map((l) => ({
        lineId: l.id,
        description: l.description,
        unit: l.unit,
        ordered: l.quantity,
        received: l.receivedQuantity,
        receiveQuantity: Math.max(0, l.quantity - l.receivedQuantity),
      })),
    });
    setReceiveModalPo(po);
  };

  const handleSubmitReceivePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalPo) return;
    try {
      await apiClient.post(`/purchase-orders/${receiveModalPo.id}/receive`, {
        warehouseId: receiveForm.warehouseId || null,
        createExpenseRecord: receiveForm.createExpenseRecord,
        vendorTaxInvoiceNumber: receiveForm.vendorTaxInvoiceNumber.trim() || null,
        vendorTaxInvoiceDate: receiveForm.vendorTaxInvoiceDate || null,
        whtRate: receiveForm.whtRate,
        pndType: receiveForm.whtRate > 0 ? receiveForm.pndType : 'None',
        lines: receiveForm.lines
          .filter((l) => l.receiveQuantity > 0)
          .map((l) => ({ lineId: l.lineId, receiveQuantity: Number(l.receiveQuantity) })),
      });
      setReceiveModalPo(null);
      alert(`รับสินค้า ${receiveModalPo.poNumber} เข้าคลังสำเร็จ`);
      await fetchAll();
    } catch (err: unknown) {
      alert(getApiError(err, 'ไม่สามารถรับสินค้าได้'));
    }
  };

  const handleDownloadPoPdf = async (po: PurchaseOrderDto) => {
    try {
      const res = await apiClient.get(`/purchase-orders/${po.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${po.poNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถดาวน์โหลด PDF ใบสั่งซื้อได้');
    }
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendorId) {
        await apiClient.put(`/vendors/${editingVendorId}`, vendorForm);
      } else {
        await apiClient.post('/vendors', vendorForm);
      }
      setVendorModalOpen(false);
      await fetchAll();
    } catch (err: unknown) {
      alert(getApiError(err, 'ไม่สามารถบันทึกผู้ขายได้'));
    }
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">จัดซื้อ &amp; ใบสั่งซื้อ (Purchase Orders &amp; Vendors)</h2>
            <p className="text-sm text-[var(--color-text-muted)]">ออกใบสั่งซื้อ PO รับสินค้าเข้าคลัง และสร้างใบสำคัญจ่าย/ภาษีซื้ออัตโนมัติ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingVendorId(null);
              setVendorForm({
                name: '',
                taxId: '',
                branch: '00000',
                address: '',
                phone: '',
                email: '',
                contactPerson: '',
                paymentTermsDays: 30,
                defaultWhtRate: 0,
                defaultPndType: 'None',
              });
              setVendorModalOpen(true);
            }}
            className="btn btn-secondary flex items-center gap-1.5 text-xs"
          >
            <Building size={15} /> เพิ่มผู้ขาย
          </button>
          <button
            type="button"
            onClick={() => {
              setPoForm((prev) => ({
                ...prev,
                warehouseId: warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '',
              }));
              setPoModalOpen(true);
            }}
            className="btn btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} /> สร้างใบสั่งซื้อ (PO)
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('po')}
            className={`btn text-xs ${tab === 'po' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <ShoppingBag size={14} /> ใบสั่งซื้อ ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('vendors')}
            className={`btn text-xs ${tab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Building size={14} /> ทะเบียนผู้ขาย ({vendors.length})
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="ค้นหาเลขที่ PO หรือชื่อผู้ขาย..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {tab === 'po' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table table-responsive">
              <thead>
                <tr>
                  <th>เลขที่ PO</th>
                  <th>วันที่สั่งซื้อ</th>
                  <th>ผู้ขาย / ซัพพลายเออร์</th>
                  <th>คลังรับสินค้า</th>
                  <th className="text-right">ยอดสุทธิ</th>
                  <th className="text-center">สถานะ</th>
                  <th className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">กำลังโหลด...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-[var(--color-text-muted)]">ยังไม่มีใบสั่งซื้อ</td></tr>
                ) : (
                  orders.map((po) => {
                    const st = STATUS_BADGE[po.status] ?? { label: po.status, cls: 'badge-info' };
                    return (
                      <tr key={po.id}>
                        <td className="font-mono font-semibold text-sm">{po.poNumber}</td>
                        <td className="text-sm">{new Date(po.orderDate).toLocaleDateString('th-TH')}</td>
                        <td>
                          <div className="font-medium text-sm">{po.vendorName}</div>
                          {po.vendorTaxId && <div className="text-xs font-mono text-[var(--color-text-muted)]">{po.vendorTaxId}</div>}
                        </td>
                        <td className="text-sm">{po.warehouseName || 'คลังสินค้าหลัก'}</td>
                        <td className="text-right font-mono font-semibold text-sm">{formatCurrency(po.grandTotal)}</td>
                        <td className="text-center"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            {(po.status === 'Sent' || po.status === 'PartiallyReceived' || po.status === 'Draft') && (
                              <button
                                type="button"
                                onClick={() => openReceiveModal(po)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                                title="รับสินค้าเข้าคลัง"
                              >
                                <PackageCheck size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDownloadPoPdf(po)}
                              className="p-1.5 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                              title="พิมพ์ใบสั่งซื้อ (PDF)"
                            >
                              <FileText size={16} />
                            </button>
                            {po.status !== 'Received' && po.status !== 'Cancelled' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`ยกเลิกใบสั่งซื้อ ${po.poNumber}?`)) return;
                                  await apiClient.post(`/purchase-orders/${po.id}/cancel`, { reason: 'ยกเลิกโดยผู้ใช้' });
                                  await fetchAll();
                                }}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"
                                title="ยกเลิก"
                              >
                                <Ban size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table table-responsive">
              <thead>
                <tr>
                  <th>ชื่อผู้ขาย / ซัพพลายเออร์</th>
                  <th>เลขผู้เสียภาษี (สาขา)</th>
                  <th>ผู้ติดต่อ / โทรศัพท์</th>
                  <th className="text-center">เครดิต (วัน)</th>
                  <th className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-[var(--color-text-muted)]">ยังไม่มีผู้ขายในทะเบียน</td></tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium text-sm">{v.name}</td>
                      <td className="font-mono text-xs">{v.taxId ? `${v.taxId} (${v.branch || '00000'})` : '-'}</td>
                      <td className="text-sm">{[v.contactPerson, v.phone].filter(Boolean).join(' • ') || '-'}</td>
                      <td className="text-center text-sm">{v.paymentTermsDays}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVendorId(v.id);
                              setVendorForm({
                                name: v.name,
                                taxId: v.taxId ?? '',
                                branch: v.branch ?? '00000',
                                address: v.address ?? '',
                                phone: v.phone ?? '',
                                email: v.email ?? '',
                                contactPerson: v.contactPerson ?? '',
                                paymentTermsDays: v.paymentTermsDays ?? 30,
                                defaultWhtRate: v.defaultWhtRate ?? 0,
                                defaultPndType: v.defaultPndType ?? 'None',
                              });
                              setVendorModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                            title="แก้ไข"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`ลบผู้ขาย ${v.name}?`)) return;
                              await apiClient.delete(`/vendors/${v.id}`);
                              await fetchAll();
                            }}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"
                            title="ลบ"
                          >
                            <Trash2 size={15} />
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

      {/* PO Modal */}
      {poModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg">สร้างใบสั่งซื้อใหม่ (Purchase Order)</h3>
                <button type="button" onClick={() => setPoModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={(e) => void handleCreatePo(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">วันที่สั่งซื้อ *</label>
                    <input required type="date" className="input-field" value={poForm.orderDate} onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เลือกผู้ขายจากทะเบียน</label>
                    <select className="input-field" value={poForm.vendorId} onChange={(e) => handleSelectVendor(e.target.value)}>
                      <option value="">-- กรอกเองหรือเลือกผู้ขาย --</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">คลังสินค้าปลายทาง</label>
                    <select className="input-field" value={poForm.warehouseId} onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium mb-1">ชื่อผู้ขาย *</label>
                    <input required type="text" className="input-field" value={poForm.vendorName} onChange={(e) => setPoForm({ ...poForm, vendorName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เลขผู้เสียภาษี</label>
                    <input type="text" className="input-field font-mono" value={poForm.vendorTaxId} onChange={(e) => setPoForm({ ...poForm, vendorTaxId: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">รายการสินค้าที่สั่งซื้อ</span>
                    <button
                      type="button"
                      onClick={() => setPoForm((p) => ({ ...p, lines: [...p.lines, { productId: '', description: '', unit: 'ชิ้น', quantity: 1, unitPrice: 0, discountAmount: 0 }] }))}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      + เพิ่มรายการ
                    </button>
                  </div>
                  {poForm.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        className="input-field col-span-4 text-xs"
                        value={line.productId}
                        onChange={(e) => handleSelectProduct(idx, e.target.value)}
                      >
                        <option value="">-- สินค้าในคลัง --</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input
                        required
                        type="text"
                        className="input-field col-span-3 text-xs"
                        placeholder="รายละเอียด"
                        value={line.description}
                        onChange={(e) => {
                          const lines = [...poForm.lines];
                          lines[idx].description = e.target.value;
                          setPoForm({ ...poForm, lines });
                        }}
                      />
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input-field col-span-2 text-xs text-right"
                        value={line.quantity}
                        onChange={(e) => {
                          const lines = [...poForm.lines];
                          lines[idx].quantity = Number(e.target.value);
                          setPoForm({ ...poForm, lines });
                        }}
                      />
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-field col-span-2 text-xs text-right"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const lines = [...poForm.lines];
                          lines[idx].unitPrice = Number(e.target.value);
                          setPoForm({ ...poForm, lines });
                        }}
                      />
                      <button
                        type="button"
                        disabled={poForm.lines.length === 1}
                        onClick={() => setPoForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))}
                        className="col-span-1 text-red-500 flex justify-center"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setPoModalOpen(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary flex items-center gap-1.5"><Save size={16} /> บันทึกใบสั่งซื้อ</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Vendor Modal */}
      {vendorModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg">{editingVendorId ? 'แก้ไขข้อมูลผู้ขาย / ซัพพลายเออร์' : 'เพิ่มผู้ขาย / ซัพพลายเออร์'}</h3>
                <button type="button" onClick={() => setVendorModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={(e) => void handleSaveVendor(e)} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">ชื่อผู้ขาย *</label>
                  <input required type="text" className="input-field" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">เลขประจำตัวผู้เสียภาษี</label>
                    <input type="text" maxLength={13} className="input-field font-mono" value={vendorForm.taxId} onChange={(e) => setVendorForm({ ...vendorForm, taxId: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">สาขา</label>
                    <input type="text" className="input-field font-mono" value={vendorForm.branch} onChange={(e) => setVendorForm({ ...vendorForm, branch: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">ผู้ติดต่อ</label>
                    <input type="text" className="input-field" value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เบอร์โทรศัพท์</label>
                    <input type="text" className="input-field" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">อีเมล</label>
                    <input type="email" className="input-field" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เครดิตการชำระเงิน (วัน)</label>
                    <input type="number" min={0} className="input-field" value={vendorForm.paymentTermsDays} onChange={(e) => setVendorForm({ ...vendorForm, paymentTermsDays: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">หัก ณ ที่จ่ายเริ่มต้น (%)</label>
                    <select
                      className="input-field"
                      value={vendorForm.defaultWhtRate}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setVendorForm({
                          ...vendorForm,
                          defaultWhtRate: rate,
                          defaultPndType: rate > 0 && vendorForm.defaultPndType === 'None' ? 'PND53' : rate === 0 ? 'None' : vendorForm.defaultPndType,
                        });
                      }}
                    >
                      <option value={0}>ไม่หัก (0%)</option>
                      <option value={1}>1% (ค่าขนส่ง)</option>
                      <option value={2}>2% (ค่าโฆษณา)</option>
                      <option value={3}>3% (ค่าบริการ/จ้างทำของ)</option>
                      <option value={5}>5% (ค่าเช่า)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">แบบ ภ.ง.ด. เริ่มต้น</label>
                    <select
                      className="input-field"
                      disabled={vendorForm.defaultWhtRate <= 0}
                      value={vendorForm.defaultPndType}
                      onChange={(e) => setVendorForm({ ...vendorForm, defaultPndType: e.target.value as 'None' | 'PND3' | 'PND53' })}
                    >
                      <option value="None">ไม่ระบุ</option>
                      <option value="PND3">ภ.ง.ด.3 (บุคคลธรรมดา)</option>
                      <option value="PND53">ภ.ง.ด.53 (นิติบุคคล)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">ที่อยู่</label>
                  <textarea rows={2} className="input-field" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setVendorModalOpen(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary flex items-center gap-1.5"><Save size={16} /> บันทึก</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Receive PO Modal (Supports Partial Receive & Vendor Tax Invoice) */}
      {receiveModalPo &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 className="font-bold text-lg">รับสินค้าเข้าคลัง — {receiveModalPo.poNumber}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">ผู้ขาย: {receiveModalPo.vendorName}</p>
                </div>
                <button type="button" onClick={() => setReceiveModalPo(null)}><X size={20} /></button>
              </div>
              <form onSubmit={(e) => void handleSubmitReceivePo(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">คลังสินค้ารับเข้า</label>
                    <select
                      className="input-field"
                      value={receiveForm.warehouseId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, warehouseId: e.target.value })}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เลขที่ใบกำกับภาษีผู้ขาย</label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      placeholder="เช่น TAX-2026-001"
                      value={receiveForm.vendorTaxInvoiceNumber}
                      onChange={(e) => setReceiveForm({ ...receiveForm, vendorTaxInvoiceNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">วันที่ใบกำกับภาษีผู้ขาย</label>
                    <input
                      type="date"
                      className="input-field"
                      value={receiveForm.vendorTaxInvoiceDate}
                      onChange={(e) => setReceiveForm({ ...receiveForm, vendorTaxInvoiceDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-[var(--color-border)] rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                        <th className="p-2 text-left">รายการ</th>
                        <th className="p-2 text-right">สั่งซื้อ</th>
                        <th className="p-2 text-right">รับแล้ว</th>
                        <th className="p-2 text-right w-28">รับครั้งนี้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveForm.lines.map((line, idx) => {
                        const maxRemain = Math.max(0, line.ordered - line.received);
                        return (
                          <tr key={line.lineId} className="border-t border-[var(--color-border)]">
                            <td className="p-2 font-medium">{line.description} ({line.unit})</td>
                            <td className="p-2 text-right font-mono">{line.ordered}</td>
                            <td className="p-2 text-right font-mono">{line.received}</td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min={0}
                                max={maxRemain}
                                step="0.01"
                                disabled={maxRemain <= 0}
                                className="input-field py-1 text-right font-mono text-xs"
                                value={line.receiveQuantity}
                                onChange={(e) => {
                                  const val = Math.min(maxRemain, Math.max(0, parseFloat(e.target.value) || 0));
                                  const next = [...receiveForm.lines];
                                  next[idx] = { ...next[idx], receiveQuantity: val };
                                  setReceiveForm({ ...receiveForm, lines: next });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={receiveForm.createExpenseRecord}
                      onChange={(e) => setReceiveForm({ ...receiveForm, createExpenseRecord: e.target.checked })}
                    />
                    สร้างใบสำคัญจ่าย / ภาษีซื้ออัตโนมัติ (เมื่อรับสินค้าครบตาม PO)
                  </label>
                  {receiveForm.createExpenseRecord && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">หัก ณ ที่จ่าย (%)</label>
                        <select
                          className="input-field text-xs"
                          value={receiveForm.whtRate}
                          onChange={(e) => {
                            const rate = Number(e.target.value);
                            setReceiveForm({
                              ...receiveForm,
                              whtRate: rate,
                              pndType: rate > 0 && receiveForm.pndType === 'None' ? 'PND53' : rate === 0 ? 'None' : receiveForm.pndType,
                            });
                          }}
                        >
                          <option value={0}>ไม่หัก (0%)</option>
                          <option value={1}>1%</option>
                          <option value={2}>2%</option>
                          <option value={3}>3%</option>
                          <option value={5}>5%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">แบบ ภ.ง.ด.</label>
                        <select
                          className="input-field text-xs"
                          disabled={receiveForm.whtRate <= 0}
                          value={receiveForm.pndType}
                          onChange={(e) => setReceiveForm({ ...receiveForm, pndType: e.target.value as 'None' | 'PND3' | 'PND53' })}
                        >
                          <option value="None">ไม่ระบุ</option>
                          <option value="PND3">ภ.ง.ด.3</option>
                          <option value="PND53">ภ.ง.ด.53</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setReceiveModalPo(null)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" className="btn btn-primary flex items-center gap-1.5"><PackageCheck size={16} /> ยืนยันรับสินค้าเข้าคลัง</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

