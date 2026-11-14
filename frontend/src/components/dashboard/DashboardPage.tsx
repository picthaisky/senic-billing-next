import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, FileText, Clock, ArrowUpRight, ArrowDownRight,
  Receipt, Banknote, Truck, FileCheck, Download, Loader2, Printer, Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { exportToExcel } from '../../utils/exportUtils';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useTheme } from '../../hooks/useTheme';
import { getDocumentTypeByNumber, getDocumentTypeMeta } from '../../utils/documentTypeMeta';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type DashboardSummaryDto = {
  totalRevenue: number;
  documentsIssued: number;
  pendingDocuments: number;
  monthlyGrowthPercent: number;
};

type MonthlyRevenueDto = {
  month: string;
  goodsValue: number;
  vatAmount: number;
};

type TopProductDto = {
  productName: string;
  totalRevenue: number;
  totalQuantity: number;
};

type AgingReportDto = {
  current: number;
  overdue1_30: number;
  overdue31_60: number;
  overdue61_90: number;
  overdue90Plus: number;
  totalOverdue: number;
};

type TaxEstimatorDto = {
  totalSalesVat: number;
  totalPurchaseVat: number;
  estimatedTaxPayable: number;
  whtDeducted: number;
};

type RecentActivityDto = {
  id: string;
  documentNumber: string;
  documentType: 'Receipt' | 'CashBill' | 'DeliveryNote' | 'TaxInvoice' | 'Quotation' | 'CreditNote' | 'DebitNote';
  customerName: string | null;
  grandTotal: number;
  createdAt: string;
};

type RevenueChartPoint = {
  month: string;
  goods: number;
  vat: number;
};

type ProductPiePoint = {
  name: string;
  value: number;
};

type RecentDocumentItem = {
  id: string;
  number: string;
  documentType: RecentActivityDto['documentType'];
  customer: string;
  amount: number;
  createdAt: string;
  icon: LucideIcon;
};

type TopSpenderDto = {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchaseDate: string | null;
};

type DashboardViewModel = {
  revenueData: RevenueChartPoint[];
  productData: ProductPiePoint[];
  recentDocs: RecentDocumentItem[];
  topSpenders: TopSpenderDto[];
  agingData: AgingReportDto | null;
  taxData: TaxEstimatorDto | null;
  kpiStats: {
    totalRevenue: number;
    documentsIssued: number;
    pendingDrafts: number;
    monthlyGrowthPercent: number;
    currentMonthRevenue: number;
  };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const getLastSixMonthKeys = (locale: string) => {
  const now = new Date();
  const keys: Array<{ key: string; label: string }> = [];

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(monthDate);
    keys.push({ key, label });
  }

  return keys;
};

const getDocumentTypeLabel = (
  documentType: RecentActivityDto['documentType'],
  t: (key: string) => string
) => {
  switch (documentType) {
    case 'TaxInvoice':
      return t('docType.taxinvoice');
    case 'Quotation':
      return t('docType.quotation');
    case 'Receipt':
      return t('docType.receipt');
    case 'CashBill':
      return t('docType.cashbill');
    case 'DeliveryNote':
      return t('docType.delivery');
    case 'CreditNote':
      return t('docType.creditnote');
    case 'DebitNote':
      return t('docType.debitnote');
    default:
      return t('forms.genericDocument');
  }
};

const getDocumentTypeIcon = (documentType: RecentActivityDto['documentType']) => {
  switch (documentType) {
    case 'TaxInvoice':
      return FileCheck;
    case 'Quotation':
      return FileText;
    case 'Receipt':
      return Receipt;
    case 'CashBill':
      return Banknote;
    case 'DeliveryNote':
      return Truck;
    case 'CreditNote':
    case 'DebitNote':
      return FileText;
    default:
      return FileText;
  }
};

const formatRelativeTime = (
  isoDate: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string
) => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, now - then);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute));
    return t('dashboard.minutesAgo', { count: minutes });
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return t('dashboard.hoursAgo', { count: hours });
  }

  if (diff < day * 2) {
    return t('dashboard.yesterday');
  }

  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(isoDate));
};

const formatTooltipCurrency = (value: number | string | readonly (number | string)[] | undefined) => {
  if (Array.isArray(value)) {
    return value.map((v) => formatCurrency(Number(v))).join(', ');
  }

  return formatCurrency(Number(value || 0));
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const { theme } = useTheme();
  const chartColors = theme === 'deep-ocean'
    ? ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']
    : ['#ea580c', '#f97316', '#fbbf24', '#fcd34d', '#fed7aa'];

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardViewModel>({
    revenueData: [],
    productData: [],
    recentDocs: [],
    topSpenders: [],
    agingData: null,
    taxData: null,
    kpiStats: {
      totalRevenue: 0,
      documentsIssued: 0,
      pendingDrafts: 0,
      monthlyGrowthPercent: 0,
      currentMonthRevenue: 0,
    }
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const [summaryRes, revenueRes, topProductRes, recentRes, agingRes, taxRes, spendersRes] = await Promise.all([
        apiClient.get<ApiEnvelope<DashboardSummaryDto>>('/dashboard/summary'),
        apiClient.get<ApiEnvelope<MonthlyRevenueDto[]>>('/dashboard/revenue-chart'),
        apiClient.get<ApiEnvelope<TopProductDto[]>>('/dashboard/top-products?top=5'),
        apiClient.get<ApiEnvelope<RecentActivityDto[]>>('/dashboard/recent-activity?count=8'),
        apiClient.get<ApiEnvelope<AgingReportDto>>('/dashboard/aging-report'),
        apiClient.get<ApiEnvelope<TaxEstimatorDto>>('/dashboard/tax-estimator'),
        apiClient.get<ApiEnvelope<TopSpenderDto[]>>('/dashboard/top-spenders?top=5')
      ]);

      const summary = summaryRes.data.data;
      const monthlyRevenue = revenueRes.data.data ?? [];
      const topProducts = topProductRes.data.data ?? [];
      const recentActivity = recentRes.data.data ?? [];
      const agingData = agingRes.data.data;
      const taxData = taxRes.data.data;
      const topSpenders = spendersRes.data.data ?? [];

      const monthKeys = getLastSixMonthKeys('th-TH');
      const revenueByMonth = new Map(monthlyRevenue.map((item) => [item.month, item]));
      const normalizedRevenue: RevenueChartPoint[] = monthKeys.map(({ key, label }) => {
        const monthData = revenueByMonth.get(key);
        return {
          month: label,
          goods: Number(monthData?.goodsValue ?? 0),
          vat: Number(monthData?.vatAmount ?? 0)
        };
      });

      const currentMonth = normalizedRevenue[normalizedRevenue.length - 1];
      const currentMonthRevenue = (currentMonth?.goods ?? 0) + (currentMonth?.vat ?? 0);

      const normalizedProducts: ProductPiePoint[] = topProducts.map((item) => ({
        name: item.productName,
        value: Number(item.totalRevenue)
      }));

      const normalizedRecentDocs: RecentDocumentItem[] = recentActivity.map((item) => ({
        id: item.id,
        number: item.documentNumber,
        documentType: item.documentType,
        customer: item.customerName || '-',
        amount: Number(item.grandTotal),
        createdAt: item.createdAt,
        icon: getDocumentTypeIcon(item.documentType)
      }));

      setDashboardData({
        revenueData: normalizedRevenue,
        productData: normalizedProducts,
        recentDocs: normalizedRecentDocs,
        topSpenders,
        agingData: agingData,
        taxData: taxData,
        kpiStats: {
          totalRevenue: Number(summary.totalRevenue ?? 0),
          documentsIssued: Number(summary.documentsIssued ?? 0),
          pendingDrafts: Number(summary.pendingDocuments ?? 0),
          monthlyGrowthPercent: Number(summary.monthlyGrowthPercent ?? 0),
          currentMonthRevenue,
        }
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  const handleRefresh = async () => {
    await fetchDashboard();
  };

  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: handleRefresh });

  const kpis = useMemo(() => [
    {
      id: 'revenue',
      label: t('dashboard.kpiTotalRevenue'),
      value: formatCurrency(dashboardData.kpiStats.totalRevenue),
      change: `${dashboardData.kpiStats.monthlyGrowthPercent >= 0 ? '+' : ''}${dashboardData.kpiStats.monthlyGrowthPercent.toFixed(1)}%`,
      positive: dashboardData.kpiStats.monthlyGrowthPercent >= 0,
      icon: TrendingUp,
      desc: t('dashboard.kpiTotalRevenueDesc'),
    },
    {
      id: 'issued',
      label: t('dashboard.kpiDocumentsIssued'),
      value: dashboardData.kpiStats.documentsIssued.toString(),
      change: `+${dashboardData.kpiStats.documentsIssued}`,
      positive: true,
      icon: FileText,
      desc: t('dashboard.kpiDocumentsIssuedDesc'),
    },
    {
      id: 'pending',
      label: t('dashboard.kpiPendingDrafts'),
      value: dashboardData.kpiStats.pendingDrafts.toString(),
      change: `-${dashboardData.kpiStats.pendingDrafts}`,
      positive: dashboardData.kpiStats.pendingDrafts === 0,
      icon: Clock,
      desc: t('dashboard.kpiPendingDraftsDesc'),
    },
    {
      id: 'growth',
      label: t('dashboard.kpiMomGrowth'),
      value: `${dashboardData.kpiStats.monthlyGrowthPercent >= 0 ? '+' : ''}${dashboardData.kpiStats.monthlyGrowthPercent.toFixed(1)}%`,
      change: formatCurrency(dashboardData.kpiStats.currentMonthRevenue),
      positive: dashboardData.kpiStats.monthlyGrowthPercent >= 0,
      icon: TrendingUp,
      desc: t('dashboard.kpiMomGrowthDesc'),
    },
  ], [dashboardData, t]);

  const handleExport = () => {
    const mapping = {
      number: t('dashboard.colDocNumber'),
      type: t('dashboard.colType'),
      customer: t('dashboard.colCustomer'),
      amount: t('dashboard.colAmount'),
      date: t('dashboard.colTime')
    };

    const exportData = dashboardData.recentDocs.map((doc) => ({
      number: doc.number,
      type: getDocumentTypeLabel(doc.documentType, t),
      customer: doc.customer,
      amount: doc.amount,
      date: formatRelativeTime(doc.createdAt, t, locale)
    }));

    exportToExcel(exportData, 'Recent_Documents', mapping);
  };

  return (
    <div className="dashboard-stack relative">
      
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="absolute left-0 right-0 -top-12 flex justify-center items-center h-12">
          <div className="bg-white shadow-md rounded-full p-2 flex items-center justify-center">
            <Loader2 size={20} className={`text-orange-500 ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">{t('dashboard.title')}</h2>
          <p className="dashboard-page-subtitle text-sm text-[var(--color-text-muted)]">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.id}
            className={`kpi-card relative overflow-hidden animate-fade-in-up !p-4 sm:!p-6 delay-${Math.min(i + 1, 5)}`}
          >
            {/* Watermark Icon */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transform rotate-12">
              <kpi.icon size={80} />
            </div>

            <div className="dashboard-kpi-head flex items-start justify-between relative z-10">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                <kpi.icon size={18} />
              </div>
              <span className={`dashboard-kpi-change-badge flex items-center gap-0.5 text-[11px] font-semibold rounded-full ${kpi.positive ? 'kpi-chg-up' : 'kpi-chg-down'}`}>
                {kpi.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {kpi.change}
              </span>
            </div>
            <p className="dashboard-kpi-value text-xl sm:text-2xl font-bold relative z-10 tabular-nums truncate text-[var(--color-text)]">{kpi.value}</p>
            <p className="text-[11px] sm:text-xs relative z-10 text-[var(--color-text-muted)]">{kpi.label} — {kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card dashboard-panel-card">
          <div className="dashboard-panel-head flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[var(--color-text)]">
                {t('dashboard.revenueChartTitle')}
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)]">
                {t('dashboard.revenueChartSubtitle')}
              </p>
            </div>
            <span className="badge badge-neutral">{t('dashboard.sixMonths')}</span>
          </div>
          <div className={`h-[280px] ${loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.revenueData} barGap={2}>
                <defs>
                  <linearGradient id="colorGoods" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                  </linearGradient>
                  <linearGradient id="colorVat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent-light)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--color-accent-light)" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-solid)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: 13,
                  }}
                  formatter={formatTooltipCurrency}
                />
                <Bar dataKey="goods" name={t('dashboard.goodsValue')} fill="url(#colorGoods)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="vat" name={t('dashboard.salesVat7')} fill="url(#colorVat)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Pie Chart */}
        <div className="card dashboard-panel-card">
          <div className="dashboard-panel-head flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[var(--color-text)]">
                {t('dashboard.topProductsTitle')}
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)]">
                {t('dashboard.topProductsSubtitle')}
              </p>
            </div>
            <span className="badge badge-neutral">{t('dashboard.byValue')}</span>
          </div>
          <div className={`h-[280px] ${loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {dashboardData.productData.map((_item, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-solid)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: 13,
                  }}
                  formatter={formatTooltipCurrency}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: number | string) => <span className="text-[var(--color-text-secondary)]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 mb-6">
        {/* Tax Estimator */}
        <div className="card dashboard-panel-card p-6 bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-bg)] overflow-hidden">
          <div className="dashboard-panel-head flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-[var(--color-text)] flex items-center gap-2">
                <FileText size={18} className="text-[var(--color-primary)]" />
                {t('dashboard.taxEstimatorTitle')}
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)] mt-1">
                {t('dashboard.taxEstimatorSubtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = now.getMonth() + 1;
                    const res = await apiClient.get(`/reports/tax/export?year=${y}&month=${m}`, {
                      responseType: 'blob',
                    });
                    const blob = new Blob([res.data], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `OutputTax_${y}_${String(m).padStart(2, '0')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch {
                    alert(t('dashboard.outputVatError'));
                  }
                }}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title={t('dashboard.outputVatBtnTitle')}
              >
                <Download size={14} /> {t('dashboard.outputVatBtn')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = now.getMonth() + 1;
                    const res = await apiClient.get(`/reports/input-tax/export?year=${y}&month=${m}`, {
                      responseType: 'blob',
                    });
                    const blob = new Blob([res.data], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `InputTax_PP30_${y}_${String(m).padStart(2, '0')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch {
                    alert(t('dashboard.inputVatError'));
                  }
                }}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title={t('dashboard.inputVatBtnTitle')}
              >
                <Download size={14} /> {t('dashboard.inputVatBtn')}
              </button>
            </div>
          </div>
          <div className={`mt-4 grid grid-cols-2 gap-4 ${loading ? 'opacity-50' : ''}`}>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.salesVatCard')}</p>
              <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(dashboardData.taxData?.totalSalesVat || 0)}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.purchaseVatCard')}</p>
              <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(dashboardData.taxData?.totalPurchaseVat || 0)}</p>
            </div>
            <div className="bg-[var(--color-primary)] p-5 rounded-xl shadow-sm col-span-2 text-white">
              <p className="text-sm opacity-90">
                {(dashboardData.taxData?.estimatedTaxPayable || 0) >= 0
                  ? t('dashboard.netVatPayable')
                  : t('dashboard.netVatCredit')}
              </p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(Math.abs(dashboardData.taxData?.estimatedTaxPayable || 0))}</p>
              <p className="text-xs opacity-80 mt-2">*{t('dashboard.whtCumulative')}: {formatCurrency(dashboardData.taxData?.whtDeducted || 0)}</p>
            </div>
          </div>
        </div>

        {/* A/R Aging Report */}
        <div className="card dashboard-panel-card p-6">
          <div className="dashboard-panel-head flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[var(--color-text)] flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                {t('dashboard.arAgingTitle')}
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)] mt-1">
                {t('dashboard.arAgingSubtitle')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.totalOverdue')}</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(dashboardData.agingData?.totalOverdue || 0)}</p>
            </div>
          </div>
          <div className={`mt-4 ${loading ? 'opacity-50' : ''}`}>
            <div className="space-y-3">
              {[
                { label: t('dashboard.agingCurrent'), value: dashboardData.agingData?.current || 0, color: 'bg-green-500' },
                { label: t('dashboard.aging1_30'), value: dashboardData.agingData?.overdue1_30 || 0, color: 'bg-yellow-400' },
                { label: t('dashboard.aging31_60'), value: dashboardData.agingData?.overdue31_60 || 0, color: 'bg-orange-500' },
                { label: t('dashboard.aging61_90'), value: dashboardData.agingData?.overdue61_90 || 0, color: 'bg-red-500' },
                { label: t('dashboard.aging90Plus'), value: dashboardData.agingData?.overdue90Plus || 0, color: 'bg-red-700' }
              ].map((item, idx) => {
                const total = (dashboardData.agingData?.totalOverdue || 0) + (dashboardData.agingData?.current || 0);
                const percent = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <div className="w-32 text-[var(--color-text-muted)]">{item.label}</div>
                    <div className="flex-1 h-3 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="w-24 text-right font-medium">{formatCurrency(item.value)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Spenders */}
      <div className="card dashboard-panel-card p-6 mb-6">
        <div className="dashboard-panel-head flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-[var(--color-text)] flex items-center gap-2">
              <Users size={18} className="text-[var(--color-primary)]" />
              {t('dashboard.topSpendersTitle')}
            </h3>
            <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)] mt-1">
              {t('dashboard.topSpendersSubtitle')}
            </p>
          </div>
          <span className="badge badge-neutral">{t('dashboard.top5')}</span>
        </div>
        {dashboardData.topSpenders.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            {loading ? t('dashboard.loading') : t('dashboard.noTopSpenders')}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {dashboardData.topSpenders.map((spender, index) => (
              <div
                key={spender.customerId || spender.customerName}
                className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="badge badge-primary text-[11px] px-2 py-0.5">#{index + 1}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{spender.totalOrders} {t('dashboard.billsSuffix')}</span>
                </div>
                <p className="font-semibold text-sm text-[var(--color-text)] truncate" title={spender.customerName}>
                  {spender.customerName}
                </p>
                <p className="text-base font-bold text-[var(--color-primary)] tabular-nums">
                  {formatCurrency(spender.totalSpent)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="dashboard-recent-head flex items-center justify-between border-b border-[var(--color-border)]">
          <h3 className="font-bold text-base text-[var(--color-text)]">
            {t('dashboard.recentDocsTitle')}
          </h3>
          <button className="btn btn-secondary dashboard-export-btn text-xs" onClick={handleExport}>
            <Download size={14} /> {t('dashboard.exportExcel')}
          </button>
        </div>
        <table className="data-table table-responsive dashboard-recent-table">
          <thead>
            <tr>
              <th>{t('dashboard.colDocNumber')}</th>
              <th>{t('dashboard.colType')}</th>
              <th>{t('dashboard.colCustomer')}</th>
              <th className="text-right">{t('dashboard.colAmount')}</th>
              <th className="text-right">{t('dashboard.colTime')}</th>
              <th className="text-center w-24">{t('dashboard.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.recentDocs.map((doc) => {
              const DocIcon = doc.icon;
              return (
              <tr key={doc.id}>
                <td data-label={t('dashboard.colDocNumber')}>
                  <div className="flex items-center gap-2">
                    <DocIcon size={16} className="text-[var(--color-primary)]" />
                    <span className="font-semibold text-sm font-mono tracking-tight">{doc.number}</span>
                  </div>
                </td>
                <td data-label={t('dashboard.colType')}>
                  <span className={`badge ${getDocumentTypeMeta(getDocumentTypeByNumber(doc.number)).badgeClass}`}>
                    {getDocumentTypeLabel(doc.documentType, t)}
                  </span>
                </td>
                <td data-label={t('dashboard.colCustomer')} className="text-[var(--color-text-secondary)]">{doc.customer}</td>
                <td data-label={t('dashboard.colAmount')} className="text-right font-semibold">{formatCurrency(doc.amount)}</td>
                <td data-label={t('dashboard.colTime')} className="text-right text-[var(--color-text-muted)]">{formatRelativeTime(doc.createdAt, t, locale)}</td>
                <td data-label={t('dashboard.colActions')}>
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors"
                      title={t('dashboard.printTitle')}
                      aria-label={`${t('dashboard.printTitle')} ${doc.number}`}
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}

            {!loading && dashboardData.recentDocs.length === 0 && (
              <tr>
                <td colSpan={6} className="dashboard-empty-row text-center text-[var(--color-text-muted)]">
                  {t('dashboard.noRecentDocs')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
