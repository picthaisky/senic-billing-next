import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, FileText, Clock, ArrowUpRight, ArrowDownRight,
  Receipt, Banknote, Truck, FileCheck, Download, Loader2, Printer
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

type RecentActivityDto = {
  id: string;
  documentNumber: string;
  documentType: 'Receipt' | 'CashBill' | 'DeliveryNote' | 'TaxInvoice';
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
  type: string;
  customer: string;
  amount: number;
  date: string;
  icon: LucideIcon;
};

type DashboardViewModel = {
  revenueData: RevenueChartPoint[];
  productData: ProductPiePoint[];
  recentDocs: RecentDocumentItem[];
  kpiStats: {
    totalRevenue: number;
    documentsIssued: number;
    pendingDrafts: number;
    monthlyGrowthPercent: number;
    currentMonthRevenue: number;
  };
};

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const getLastSixMonthKeys = () => {
  const now = new Date();
  const keys: Array<{ key: string; label: string }> = [];

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    keys.push({ key, label: THAI_MONTH_SHORT[monthDate.getMonth()] });
  }

  return keys;
};

const getDocumentTypeLabel = (documentType: RecentActivityDto['documentType']) => {
  switch (documentType) {
    case 'TaxInvoice':
      return 'ใบกำกับภาษี';
    case 'Receipt':
      return 'ใบเสร็จรับเงิน';
    case 'CashBill':
      return 'บิลเงินสด';
    case 'DeliveryNote':
      return 'ใบส่งของ';
    default:
      return 'เอกสาร';
  }
};

const getDocumentTypeIcon = (documentType: RecentActivityDto['documentType']) => {
  switch (documentType) {
    case 'TaxInvoice':
      return FileCheck;
    case 'Receipt':
      return Receipt;
    case 'CashBill':
      return Banknote;
    case 'DeliveryNote':
      return Truck;
    default:
      return FileText;
  }
};

const formatRelativeTime = (isoDate: string) => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, now - then);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute));
    return `${minutes} นาทีที่แล้ว`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} ชั่วโมงที่แล้ว`;
  }

  if (diff < day * 2) {
    return 'เมื่อวาน';
  }

  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(isoDate));
};

const formatTooltipCurrency = (value: string | number | Array<string | number>) => {
  if (Array.isArray(value)) {
    return value.map((v) => formatCurrency(Number(v))).join(', ');
  }

  return formatCurrency(Number(value));
};

export default function DashboardPage() {
  const { theme } = useTheme();
  const chartColors = theme === 'deep-ocean'
    ? ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']
    : ['#ea580c', '#f97316', '#fbbf24', '#fcd34d', '#fed7aa'];

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardViewModel>({
    revenueData: [],
    productData: [],
    recentDocs: [],
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

      const [summaryRes, revenueRes, topProductRes, recentRes] = await Promise.all([
        apiClient.get<ApiEnvelope<DashboardSummaryDto>>('/dashboard/summary'),
        apiClient.get<ApiEnvelope<MonthlyRevenueDto[]>>('/dashboard/revenue-chart'),
        apiClient.get<ApiEnvelope<TopProductDto[]>>('/dashboard/top-products?top=5'),
        apiClient.get<ApiEnvelope<RecentActivityDto[]>>('/dashboard/recent-activity?count=8')
      ]);

      const summary = summaryRes.data.data;
      const monthlyRevenue = revenueRes.data.data ?? [];
      const topProducts = topProductRes.data.data ?? [];
      const recentActivity = recentRes.data.data ?? [];

      const monthKeys = getLastSixMonthKeys();
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
        type: getDocumentTypeLabel(item.documentType),
        customer: item.customerName || '-',
        amount: Number(item.grandTotal),
        date: formatRelativeTime(item.createdAt),
        icon: getDocumentTypeIcon(item.documentType)
      }));

      setDashboardData({
        revenueData: normalizedRevenue,
        productData: normalizedProducts,
        recentDocs: normalizedRecentDocs,
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
    void fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = async () => {
    await fetchDashboard();
  };

  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: handleRefresh });

  const kpis = useMemo(() => [
    {
      label: 'รายได้รวม',
      value: formatCurrency(dashboardData.kpiStats.totalRevenue),
      change: `${dashboardData.kpiStats.monthlyGrowthPercent >= 0 ? '+' : ''}${dashboardData.kpiStats.monthlyGrowthPercent.toFixed(1)}%`,
      positive: dashboardData.kpiStats.monthlyGrowthPercent >= 0,
      icon: TrendingUp,
      desc: 'เทียบเดือนก่อน',
    },
    {
      label: 'เอกสารที่ออก',
      value: dashboardData.kpiStats.documentsIssued.toString(),
      change: `+${dashboardData.kpiStats.documentsIssued}`,
      positive: true,
      icon: FileText,
      desc: 'สะสมทั้งหมด',
    },
    {
      label: 'รอดำเนินการ',
      value: dashboardData.kpiStats.pendingDrafts.toString(),
      change: `-${dashboardData.kpiStats.pendingDrafts}`,
      positive: dashboardData.kpiStats.pendingDrafts === 0,
      icon: Clock,
      desc: 'เอกสารร่าง',
    },
    {
      label: 'เติบโต MoM',
      value: `${dashboardData.kpiStats.monthlyGrowthPercent >= 0 ? '+' : ''}${dashboardData.kpiStats.monthlyGrowthPercent.toFixed(1)}%`,
      change: formatCurrency(dashboardData.kpiStats.currentMonthRevenue),
      positive: dashboardData.kpiStats.monthlyGrowthPercent >= 0,
      icon: TrendingUp,
      desc: 'รายได้เดือนนี้',
    },
  ], [dashboardData]);

  const handleExport = () => {
    const mapping = {
      number: 'เลขที่เอกสาร',
      type: 'ประเภท',
      customer: 'ลูกค้า',
      amount: 'จำนวนเงิน',
      date: 'เวลา'
    };

    const exportData = dashboardData.recentDocs.map((doc) => ({
      number: doc.number,
      type: doc.type,
      customer: doc.customer,
      amount: doc.amount,
      date: doc.date
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
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">ภาพรวมธุรกิจ</h2>
          <p className="dashboard-page-subtitle text-sm text-[var(--color-text-muted)]">สรุปรายได้และเอกสารล่าสุด</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
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
                แนวโน้มรายได้ และ ภาษีขาย
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)]">
                มูลค่ารวมจากการออกเอกสาร 6 เดือนล่าสุด
              </p>
            </div>
            <span className="badge badge-neutral">6 เดือน</span>
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
                <Bar dataKey="goods" name="มูลค่าสินค้า" fill="url(#colorGoods)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="vat" name="ภาษีขาย 7%" fill="url(#colorVat)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Pie Chart */}
        <div className="card dashboard-panel-card">
          <div className="dashboard-panel-head flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[var(--color-text)]">
                สัดส่วนสินค้าที่ขายดี
              </h3>
              <p className="dashboard-panel-subtitle text-xs text-[var(--color-text-muted)]">
                Top 5 รายการจัดตามมูลค่า
              </p>
            </div>
            <span className="badge badge-neutral">จัดตามมูลค่า</span>
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

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="dashboard-recent-head flex items-center justify-between border-b border-[var(--color-border)]">
          <h3 className="font-bold text-base text-[var(--color-text)]">
            เอกสารล่าสุด
          </h3>
          <button className="btn btn-secondary dashboard-export-btn text-xs" onClick={handleExport}>
            <Download size={14} /> ส่งออก Excel
          </button>
        </div>
        <table className="data-table table-responsive dashboard-recent-table">
          <thead>
            <tr>
              <th>เลขที่เอกสาร</th>
              <th>ประเภท</th>
              <th>ลูกค้า</th>
              <th className="text-right">จำนวนเงิน</th>
              <th className="text-right">เวลา</th>
              <th className="text-center w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.recentDocs.map((doc) => {
              const DocIcon = doc.icon;
              return (
              <tr key={doc.id} className="haptic-tap">
                <td data-label="เลขที่เอกสาร">
                  <div className="flex items-center gap-2">
                    <DocIcon size={16} className="text-[var(--color-primary)]" />
                    <span className="font-semibold text-sm font-mono tracking-tight">{doc.number}</span>
                  </div>
                </td>
                <td data-label="ประเภท">
                  <span className={`badge ${getDocumentTypeMeta(getDocumentTypeByNumber(doc.number)).badgeClass}`}>
                    {doc.type}
                  </span>
                </td>
                <td data-label="ลูกค้า" className="text-[var(--color-text-secondary)]">{doc.customer}</td>
                <td data-label="จำนวนเงิน" className="text-right font-semibold">{formatCurrency(doc.amount)}</td>
                <td data-label="เวลา" className="text-right text-[var(--color-text-muted)]">{doc.date}</td>
                <td data-label="จัดการ">
                  <div className="flex items-center justify-center">
                    <button 
                      onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                      className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors haptic-tap text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                      title="พิมพ์ / ออก PDF"
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
                  ยังไม่มีเอกสารล่าสุด
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
