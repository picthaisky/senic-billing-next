import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, Plus, Search, Download, FileSpreadsheet, FileText,
  Sparkles, Edit2, Ban, X, Save, CheckCircle2, ReceiptText
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/errorUtils';

type ExpenseCategory =
  | 'CostOfGoods'
  | 'RentAndUtilities'
  | 'ProfessionalService'
  | 'Marketing'
  | 'OfficeSupplies'
  | 'Transportation'
  | 'Other';

type PndType = 'None' | 'PND3' | 'PND53';
type VatMode = 'Exclusive' | 'Inclusive';
type ExpenseStatus = 'Draft' | 'Approved' | 'Paid' | 'Cancelled';

interface ExpenseRecordDto {
  id: string;
  voucherNumber: string;
  expenseDate: string;
  taxInvoiceNumber?: string | null;
  taxInvoiceDate?: string | null;
  vendorName: string;
  vendorTaxId?: string | null;
  vendorBranch?: string | null;
  vendorAddress?: string | null;
  category: ExpenseCategory;
  description: string;
  vatMode: VatMode;
  subtotal: number;
  discountAmount: number;
  totalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  isRefundableVat: boolean;
  whtRate: number;
  whtAmount: number;
  pndType: PndType;
  incomeTypeDescription?: string | null;
  netPaidAmount: number;
  status: ExpenseStatus;
  notes?: string | null;
}

interface ExpenseSummaryDto {
  count: number;
  totalBeforeVat: number;
  totalInputVat: number;
  totalRefundableInputVat: number;
  totalWht: number;
  totalPnd3Wht: number;
  totalPnd53Wht: number;
  totalGrandTotal: number;
  totalNetPaid: number;
}

interface ExpenseFormState {
  expenseDate: string;
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorBranch: string;
  vendorAddress: string;
  category: ExpenseCategory;
  description: string;
  vatMode: VatMode;
  amount: number;
  discountAmount: number;
  vatRate: number;
  isRefundableVat: boolean;
  whtRate: number;
  pndType: PndType;
  incomeTypeDescription: string;
  status: ExpenseStatus;
  notes: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  CostOfGoods: 'ต้นทุนสินค้า / วัตถุดิบ',
  RentAndUtilities: 'ค่าเช่าและสาธารณูปโภค',
  ProfessionalService: 'ค่าบริการวิชาชีพ / จ้างทำของ',
  Marketing: 'ค่าโฆษณา / การตลาด',
  OfficeSupplies: 'อุปกรณ์สำนักงาน',
  Transportation: 'ค่าขนส่ง / เดินทาง',
  Other: 'อื่น ๆ',
};

const WHT_RATES = [0, 1, 1.5, 2, 3, 5, 10, 15];

const formatCurrency = (val: number) =>
  `฿${val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateInput = (iso?: string | null) => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

const emptyForm = (): ExpenseFormState => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    expenseDate: today,
    taxInvoiceNumber: '',
    taxInvoiceDate: today,
    vendorName: '',
    vendorTaxId: '',
    vendorBranch: '00000',
    vendorAddress: '',
    category: 'Other',
    description: '',
    vatMode: 'Exclusive',
    amount: 0,
    discountAmount: 0,
    vatRate: 7,
    isRefundableVat: true,
    whtRate: 0,
    pndType: 'None',
    incomeTypeDescription: '',
    status: 'Approved',
    notes: '',
  };
};

export default function ExpensesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [pndFilter, setPndFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState<ExpenseRecordDto[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryDto>({
    count: 0,
    totalBeforeVat: 0,
    totalInputVat: 0,
    totalRefundableInputVat: 0,
    totalWht: 0,
    totalPnd3Wht: 0,
    totalPnd53Wht: 0,
    totalGrandTotal: 0,
    totalNetPaid: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (categoryFilter) params.set('category', categoryFilter);
    if (pndFilter) params.set('pndType', pndFilter);
    if (search.trim()) params.set('search', search.trim());

    const res = await apiClient.get(`/expenses?${params.toString()}`);
    if (res.data?.success && res.data?.data) {
      return {
        items: (res.data.data.items ?? []) as ExpenseRecordDto[],
        summary: (res.data.data.summary ?? null) as ExpenseSummaryDto | null,
      };
    }
    return null;
  }, [year, month, categoryFilter, pndFilter, search]);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadExpenses();
      if (data) {
        setItems(data.items);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [loadExpenses]);

  useEffect(() => {
    let active = true;
    loadExpenses()
      .then((data) => {
        if (!active || !data) return;
        setItems(data.items);
        if (data.summary) setSummary(data.summary);
      })
      .catch((err) => {
        console.error('Failed to fetch expenses:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadExpenses]);

  // Live calculation preview matching ExpenseCalculator.cs
  const preview = useMemo(() => {
    const amount = Math.max(0, Number(form.amount) || 0);
    const discount = Math.min(amount, Math.max(0, Number(form.discountAmount) || 0));
    const afterDiscount = amount - discount;
    const vatRate = Math.max(0, Number(form.vatRate) || 0);
    const whtRate = Math.max(0, Number(form.whtRate) || 0);

    let beforeVat = afterDiscount;
    let vatAmount = 0;
    let grandTotal = afterDiscount;

    if (vatRate > 0) {
      if (form.vatMode === 'Inclusive') {
        grandTotal = afterDiscount;
        beforeVat = Math.round((afterDiscount * 100) / (100 + vatRate) * 100) / 100;
        vatAmount = Math.round((grandTotal - beforeVat) * 100) / 100;
      } else {
        beforeVat = afterDiscount;
        vatAmount = Math.round((beforeVat * vatRate) / 100 * 100) / 100;
        grandTotal = Math.round((beforeVat + vatAmount) * 100) / 100;
      }
    }

    const whtAmount = Math.round((beforeVat * whtRate) / 100 * 100) / 100;
    const netPaid = Math.round((grandTotal - whtAmount) * 100) / 100;
    return { beforeVat, vatAmount, grandTotal, whtAmount, netPaid };
  }, [form.amount, form.discountAmount, form.vatMode, form.vatRate, form.whtRate]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setReceiptText('');
    setAiNotice(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ExpenseRecordDto) => {
    setEditingId(item.id);
    setForm({
      expenseDate: toDateInput(item.expenseDate),
      taxInvoiceNumber: item.taxInvoiceNumber || '',
      taxInvoiceDate: toDateInput(item.taxInvoiceDate) || toDateInput(item.expenseDate),
      vendorName: item.vendorName,
      vendorTaxId: item.vendorTaxId || '',
      vendorBranch: item.vendorBranch || '00000',
      vendorAddress: item.vendorAddress || '',
      category: item.category,
      description: item.description,
      vatMode: item.vatMode,
      amount: item.subtotal,
      discountAmount: item.discountAmount,
      vatRate: item.vatRate,
      isRefundableVat: item.isRefundableVat,
      whtRate: item.whtRate,
      pndType: item.pndType,
      incomeTypeDescription: item.incomeTypeDescription || '',
      status: item.status,
      notes: item.notes || '',
    });
    setReceiptText('');
    setAiNotice(null);
    setIsModalOpen(true);
  };

  const handleParseAi = async () => {
    if (!receiptText.trim()) return;
    try {
      setIsParsingAi(true);
      setAiNotice(null);
      const res = await apiClient.post('/ai-assistant/parse-expense', { text: receiptText });
      const data = res.data?.data;
      if (data) {
        const hasVat = (data.vatAmount ?? 0) > 0;
        const amount =
          data.totalBeforeVat != null
            ? Number(data.totalBeforeVat)
            : data.grandTotal != null
              ? Number(data.grandTotal)
              : form.amount;

        setForm((prev) => ({
          ...prev,
          vendorName: data.vendorName || prev.vendorName,
          vendorTaxId: data.vendorTaxId || prev.vendorTaxId,
          vendorBranch: data.vendorBranch || prev.vendorBranch,
          taxInvoiceNumber: data.taxInvoiceNumber || prev.taxInvoiceNumber,
          taxInvoiceDate: data.taxInvoiceDate ? toDateInput(data.taxInvoiceDate) : prev.taxInvoiceDate,
          expenseDate: data.taxInvoiceDate ? toDateInput(data.taxInvoiceDate) : prev.expenseDate,
          category: data.suggestedCategory || prev.category,
          description: data.description || prev.description,
          vatMode: data.totalBeforeVat != null ? 'Exclusive' : 'Inclusive',
          vatRate: hasVat ? 7 : 0,
          amount,
          whtRate: data.suggestedWhtRate ?? prev.whtRate,
          pndType: data.suggestedPndType ?? prev.pndType,
        }));
        setAiNotice(res.data?.message || 'สกัดข้อมูลจากใบเสร็จสำเร็จ');
      }
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถวิเคราะห์ข้อความใบเสร็จได้'));
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const payload = {
        expenseDate: form.expenseDate,
        taxInvoiceNumber: form.taxInvoiceNumber || null,
        taxInvoiceDate: form.taxInvoiceDate || null,
        vendorName: form.vendorName,
        vendorTaxId: form.vendorTaxId || null,
        vendorBranch: form.vendorBranch || '00000',
        vendorAddress: form.vendorAddress || null,
        category: form.category,
        description: form.description,
        vatMode: form.vatMode,
        amount: Number(form.amount),
        discountAmount: Number(form.discountAmount) || 0,
        vatRate: Number(form.vatRate) || 0,
        isRefundableVat: form.vatRate > 0 ? form.isRefundableVat : false,
        whtRate: Number(form.whtRate) || 0,
        pndType: form.whtRate > 0 ? form.pndType : 'None',
        incomeTypeDescription: form.whtRate > 0 ? form.incomeTypeDescription || form.description : null,
        status: form.status,
        notes: form.notes || null,
      };

      if (editingId) {
        await apiClient.put(`/expenses/${editingId}`, payload);
      } else {
        await apiClient.post('/expenses', payload);
      }
      setIsModalOpen(false);
      await fetchExpenses();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถบันทึกใบสำคัญจ่ายได้'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelExpense = async (item: ExpenseRecordDto) => {
    const reason = window.prompt(`ระบุเหตุผลในการยกเลิกใบสำคัญจ่าย ${item.voucherNumber}:`, 'บันทึกข้อมูลผิดพลาด');
    if (reason === null) return;
    try {
      await apiClient.post(`/expenses/${item.id}/cancel`, { reason });
      await fetchExpenses();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถยกเลิกใบสำคัญจ่ายได้'));
    }
  };

  const downloadBlob = async (url: string, filename: string, mime: string) => {
    try {
      const res = await apiClient.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mime });
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถดาวน์โหลดไฟล์ได้'));
    }
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">
              ค่าใช้จ่าย &amp; ภาษีซื้อ (Expenses &amp; Input VAT)
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              บันทึกใบสำคัญจ่าย ใบกำกับภาษีซื้อ หัก ณ ที่จ่าย (50 ทวิ) และรายงาน ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadBlob(
                `/reports/input-tax/export?year=${year}&month=${month}`,
                `รายงานภาษีซื้อ_${year}_${String(month).padStart(2, '0')}.xlsx`,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              )
            }
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} /> รายงานภาษีซื้อ + ภ.พ.30
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadBlob(
                `/reports/wht/export?year=${year}&month=${month}`,
                `รายงานหักณที่จ่าย_ภงด3_53_${year}_${String(month).padStart(2, '0')}.xlsx`,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              )
            }
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={15} /> รายงาน ภ.ง.ด.3 / 53
          </button>
          <button type="button" onClick={openCreateModal} className="btn btn-primary flex items-center gap-1.5">
            <Plus size={16} /> บันทึกค่าใช้จ่าย
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">ยอดค่าใช้จ่ายรวม (เดือน {month}/{year})</p>
          <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{formatCurrency(summary.totalGrandTotal)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">ก่อนภาษี: {formatCurrency(summary.totalBeforeVat)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">ภาษีซื้อขอคืนได้ (Claimable Input VAT)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(summary.totalRefundableInputVat)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">ภาษีซื้อทั้งหมด: {formatCurrency(summary.totalInputVat)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">ภาษีหัก ณ ที่จ่ายรอนำส่ง (WHT)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(summary.totalWht)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            ภ.ง.ด.3: {formatCurrency(summary.totalPnd3Wht)} | ภ.ง.ด.53: {formatCurrency(summary.totalPnd53Wht)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">จำนวนใบสำคัญจ่ายที่ใช้งาน</p>
          <p className="text-2xl font-bold text-[var(--color-primary)] mt-1">{summary.count} รายการ</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">จ่ายสุทธิรวม: {formatCurrency(summary.totalNetPaid)}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="ค้นหาเลขที่ EXP, ชื่อผู้ขาย, เลขผู้เสียภาษี, เลขที่ใบกำกับภาษี..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input-field w-28"
          aria-label="เดือน"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              เดือน {m}
            </option>
          ))}
        </select>

        <select
          className="input-field w-28"
          aria-label="ปี"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          className="input-field w-48"
          aria-label="หมวดหมู่ค่าใช้จ่าย"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">ทุกหมวดหมู่</option>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="input-field w-36"
          aria-label="แบบ ภ.ง.ด."
          value={pndFilter}
          onChange={(e) => setPndFilter(e.target.value)}
        >
          <option value="">ทุกแบบ ภ.ง.ด.</option>
          <option value="PND3">ภ.ง.ด.3</option>
          <option value="PND53">ภ.ง.ด.53</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table table-responsive">
            <thead>
              <tr>
                <th>เลขที่เอกสาร</th>
                <th>วันที่</th>
                <th>ผู้ขาย / เลขผู้เสียภาษี</th>
                <th>หมวดหมู่ / รายละเอียด</th>
                <th className="text-right">ก่อนภาษี</th>
                <th className="text-right">ภาษีซื้อ (VAT)</th>
                <th className="text-right">หัก ณ ที่จ่าย</th>
                <th className="text-right">จ่ายสุทธิ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-[var(--color-text-muted)]">
                    กำลังโหลดข้อมูลค่าใช้จ่าย...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-[var(--color-text-muted)]">
                    ยังไม่มีรายการค่าใช้จ่ายในเดือนที่เลือก
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isCancelled = item.status === 'Cancelled';
                  return (
                    <tr key={item.id} className={isCancelled ? 'opacity-50' : ''}>
                      <td data-label="เลขที่เอกสาร">
                        <div className="font-mono font-semibold text-sm flex items-center gap-1.5">
                          <ReceiptText size={14} className="text-[var(--color-primary)]" />
                          {item.voucherNumber}
                        </div>
                        {item.taxInvoiceNumber && (
                          <div className="text-xs text-[var(--color-text-muted)]">ใบกำกับฯ: {item.taxInvoiceNumber}</div>
                        )}
                      </td>
                      <td data-label="วันที่" className="text-sm">
                        {new Date(item.expenseDate).toLocaleDateString('th-TH')}
                      </td>
                      <td data-label="ผู้ขาย">
                        <div className="font-medium text-sm">{item.vendorName}</div>
                        {item.vendorTaxId && (
                          <div className="text-xs font-mono text-[var(--color-text-muted)]">
                            {item.vendorTaxId} ({item.vendorBranch || '00000'})
                          </div>
                        )}
                      </td>
                      <td data-label="หมวดหมู่">
                        <span className="badge badge-info text-xs">{CATEGORY_LABELS[item.category]}</span>
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-[220px] truncate">
                          {item.description}
                        </div>
                      </td>
                      <td data-label="ก่อนภาษี" className="text-right font-mono text-sm">
                        {formatCurrency(item.totalBeforeVat)}
                      </td>
                      <td data-label="ภาษีซื้อ" className="text-right font-mono text-sm">
                        <div>{formatCurrency(item.vatAmount)}</div>
                        {item.vatAmount > 0 && (
                          <span className={`text-[10px] ${item.isRefundableVat ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {item.isRefundableVat ? 'ขอคืนได้' : 'ต้องห้าม'}
                          </span>
                        )}
                      </td>
                      <td data-label="หัก ณ ที่จ่าย" className="text-right font-mono text-sm">
                        {item.whtAmount > 0 ? (
                          <div>
                            <div className="text-amber-600 font-semibold">{formatCurrency(item.whtAmount)}</div>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              {item.pndType === 'PND3' ? 'ภ.ง.ด.3' : 'ภ.ง.ด.53'} ({item.whtRate}%)
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td data-label="จ่ายสุทธิ" className="text-right font-mono font-semibold text-sm">
                        {formatCurrency(item.netPaidAmount)}
                        {isCancelled && <div className="text-[10px] text-red-600">ยกเลิกแล้ว</div>}
                      </td>
                      <td data-label="จัดการ">
                        <div className="flex items-center justify-center gap-1">
                          {!isCancelled && item.whtAmount > 0 && item.pndType !== 'None' && (
                            <button
                              type="button"
                              onClick={() =>
                                void downloadBlob(
                                  `/expenses/${item.id}/wht-certificate-pdf`,
                                  `50ทวิ_${item.voucherNumber}.pdf`,
                                  'application/pdf'
                                )
                              }
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10"
                              title="พิมพ์หนังสือรับรอง 50 ทวิ (PDF)"
                            >
                              <FileText size={16} />
                            </button>
                          )}
                          {!isCancelled && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)]"
                                title="แก้ไข"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCancelExpense(item)}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-600"
                                title="ยกเลิก"
                              >
                                <Ban size={16} />
                              </button>
                            </>
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

      {/* Create / Edit Modal */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Wallet size={20} className="text-[var(--color-primary)]" />
                  {editingId ? 'แก้ไขใบสำคัญจ่าย' : 'บันทึกใบสำคัญจ่าย / ภาษีซื้อใหม่'}
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)]">
                  <X size={20} />
                </button>
              </div>

              {/* AI Smart Receipt Parser */}
              {!editingId && (
                <div className="p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5 text-[var(--color-primary)]">
                      <Sparkles size={16} /> กรอกอัตโนมัติด้วย AI (Smart Receipt Parser)
                    </span>
                    <button
                      type="button"
                      disabled={isParsingAi || !receiptText.trim()}
                      onClick={() => void handleParseAi()}
                      className="btn btn-primary text-xs py-1.5 px-3"
                    >
                      {isParsingAi ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ข้อความใบเสร็จ'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    className="input-field text-xs"
                    placeholder="วางข้อความจากใบเสร็จ/ใบกำกับภาษีซื้อ เช่น ชื่อบริษัท เลขผู้เสียภาษี 13 หลัก เลขที่ใบกำกับฯ วันที่ และยอดเงิน..."
                    value={receiptText}
                    onChange={(e) => setReceiptText(e.target.value)}
                  />
                  {aiNotice && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={14} /> {aiNotice}
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">วันที่จ่าย *</label>
                    <input
                      required
                      type="date"
                      className="input-field"
                      value={form.expenseDate}
                      onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เลขที่ใบกำกับภาษีซื้อ</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="เช่น TIV-2026-001"
                      value={form.taxInvoiceNumber}
                      onChange={(e) => setForm({ ...form, taxInvoiceNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">วันที่ในใบกำกับภาษี</label>
                    <input
                      type="date"
                      className="input-field"
                      value={form.taxInvoiceDate}
                      onChange={(e) => setForm({ ...form, taxInvoiceDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium mb-1">ชื่อผู้ขาย / ผู้รับเงิน *</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="บจก. ... หรือ ชื่อบุคคล"
                      value={form.vendorName}
                      onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">เลขผู้เสียภาษี 13 หลัก</label>
                    <input
                      type="text"
                      maxLength={13}
                      className="input-field font-mono"
                      placeholder="01055XXXXXXXX"
                      value={form.vendorTaxId}
                      onChange={(e) => setForm({ ...form, vendorTaxId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">สาขา (00000 = สนญ.)</label>
                    <input
                      type="text"
                      maxLength={10}
                      className="input-field font-mono"
                      value={form.vendorBranch}
                      onChange={(e) => setForm({ ...form, vendorBranch: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">หมวดหมู่ค่าใช้จ่าย</label>
                    <select
                      className="input-field"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">รายละเอียดค่าใช้จ่าย *</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="เช่น ค่าเช่าสำนักงาน, ค่าบริการคลาวด์"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">จำนวนเงิน *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input-field font-mono"
                      value={form.amount || ''}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">วิธีคิด VAT</label>
                    <select
                      className="input-field"
                      value={form.vatMode}
                      onChange={(e) => setForm({ ...form, vatMode: e.target.value as VatMode })}
                    >
                      <option value="Exclusive">แยก VAT 7%</option>
                      <option value="Inclusive">รวม VAT 7% แล้ว</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">อัตรา VAT (%)</label>
                    <select
                      className="input-field"
                      value={form.vatRate}
                      onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                    >
                      <option value={7}>VAT 7%</option>
                      <option value={0}>ไม่มี VAT (0%)</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isRefundableVat}
                        disabled={form.vatRate === 0}
                        onChange={(e) => setForm({ ...form, isRefundableVat: e.target.checked })}
                      />
                      ภาษีซื้อขอคืนได้
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">หัก ณ ที่จ่าย (WHT %)</label>
                    <select
                      className="input-field"
                      value={form.whtRate}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setForm({
                          ...form,
                          whtRate: rate,
                          pndType: rate === 0 ? 'None' : form.pndType === 'None' ? 'PND53' : form.pndType,
                        });
                      }}
                    >
                      {WHT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r === 0 ? 'ไม่หัก ณ ที่จ่าย' : `หัก ${r}%`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">ประเภทแบบยื่น (50 ทวิ)</label>
                    <select
                      className="input-field"
                      disabled={form.whtRate === 0}
                      value={form.pndType}
                      onChange={(e) => setForm({ ...form, pndType: e.target.value as PndType })}
                    >
                      <option value="None">ไม่ระบุ</option>
                      <option value="PND3">ภ.ง.ด.3 (บุคคลธรรมดา)</option>
                      <option value="PND53">ภ.ง.ด.53 (นิติบุคคล)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">ประเภทเงินได้ใน 50 ทวิ</label>
                    <input
                      type="text"
                      disabled={form.whtRate === 0}
                      className="input-field"
                      placeholder="เช่น ค่าบริการ, ค่าจ้างทำของ"
                      value={form.incomeTypeDescription}
                      onChange={(e) => setForm({ ...form, incomeTypeDescription: e.target.value })}
                    />
                  </div>
                </div>

                {/* Live summary */}
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)]">ก่อนภาษี</span>
                    <div className="font-mono font-bold text-sm">{formatCurrency(preview.beforeVat)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">ภาษีซื้อ ({form.vatRate}%)</span>
                    <div className="font-mono font-bold text-sm text-emerald-600">{formatCurrency(preview.vatAmount)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">รวมใบกำกับฯ</span>
                    <div className="font-mono font-bold text-sm">{formatCurrency(preview.grandTotal)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">หัก ณ ที่จ่าย ({form.whtRate}%)</span>
                    <div className="font-mono font-bold text-sm text-amber-600">-{formatCurrency(preview.whtAmount)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">ยอดจ่ายสุทธิ</span>
                    <div className="font-mono font-bold text-base text-[var(--color-primary)]">
                      {formatCurrency(preview.netPaid)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={isSaving} className="btn btn-primary flex items-center gap-1.5">
                    <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกใบสำคัญจ่าย'}
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

