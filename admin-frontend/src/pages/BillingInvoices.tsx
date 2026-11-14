import { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, CheckCircle, Clock, AlertCircle, BadgeCheck } from 'lucide-react';
import { saApiClient } from '../services/apiClient';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface SaaSInvoiceRow {
  id: string;
  tenantName: string;
  planName: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export default function BillingInvoices() {
  const { locale, t } = useAdminLocale();
  const dateLocale = locale === 'th' ? 'th-TH' : 'en-US';
  const [invoices, setInvoices] = useState<SaaSInvoiceRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await saApiClient.get('/superadmin/billing/invoices');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setInvoices(res.data.data as SaaSInvoiceRow[]);
      }
    } catch (err) {
      console.error('Failed to fetch SaaS invoices', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    saApiClient
      .get('/superadmin/billing/invoices')
      .then((res) => {
        if (active && res.data?.success && Array.isArray(res.data?.data)) {
          setInvoices(res.data.data as SaaSInvoiceRow[]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch SaaS invoices', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleMarkPaid = async (row: SaaSInvoiceRow) => {
    setMarkingId(row.id);
    try {
      const res = await saApiClient.post(`/superadmin/billing/invoices/${row.id}/mark-paid`);
      if (res.data?.success) {
        await loadInvoices();
      }
    } catch (err) {
      console.error('Failed to mark SaaS invoice paid', err);
      alert(t.invoices.markPaidFailed);
    } finally {
      setMarkingId(null);
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search.trim() ||
      inv.tenantName.toLowerCase().includes(search.trim().toLowerCase()) ||
      inv.planName.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === 'All' || inv.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = filtered.reduce((acc, row) => acc + Number(row.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-blue-600" size={24} />
            {t.invoices.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.invoices.subtitle}
          </p>
        </div>

        <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-right">
          <p className="text-xs text-slate-500">{t.invoices.filteredTotalLabel}</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">
            ฿ {totalRevenue.toLocaleString(dateLocale, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.invoices.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          aria-label={t.invoices.filterAria}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="All">{t.invoices.filterAll}</option>
          <option value="Active">Active</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.invoices.colTenant}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.invoices.colPlan}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.invoices.colAmount}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.invoices.colPeriod}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.invoices.colStatus}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600 text-right">{t.invoices.colManage}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-medium text-slate-800">{row.tenantName}</td>
                <td className="py-4 px-6">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                    {row.planName}
                  </span>
                </td>
                <td className="py-4 px-6 font-semibold text-slate-800 tabular-nums">
                  ฿ {Number(row.amount || 0).toLocaleString(dateLocale, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  {new Date(row.startDate).toLocaleDateString(dateLocale)} —{' '}
                  {new Date(row.endDate).toLocaleDateString(dateLocale)}
                </td>
                <td className="py-4 px-6">
                  {row.status === 'Active' || row.status === 'Paid' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium inline-flex items-center gap-1">
                      <CheckCircle size={13} /> {row.status}
                    </span>
                  ) : row.status === 'Pending' ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium inline-flex items-center gap-1">
                      <Clock size={13} /> {row.status}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1">
                      <AlertCircle size={13} /> {row.status}
                    </span>
                  )}
                </td>
                <td className="py-4 px-6 text-right">
                  {row.status !== 'Paid' ? (
                    <button
                      type="button"
                      disabled={markingId === row.id}
                      onClick={() => handleMarkPaid(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                    >
                      <BadgeCheck size={14} />
                      {/* ยืนยันชำระเงิน */}
                      {markingId === row.id ? t.invoices.updatingBtn : t.invoices.confirmPaidBtn}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">{t.invoices.paidDone}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  {loading ? t.invoices.loading : t.invoices.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

