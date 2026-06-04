import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, FileText, Clock, ArrowUpRight, ArrowDownRight,
  Receipt, Banknote, Truck, FileCheck, Download, Loader2, Printer
} from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useTheme } from '../../hooks/useTheme';

// Mock data for demonstration
const revenueData = [
  { month: 'ม.ค.', goods: 120000, vat: 8400 },
  { month: 'ก.พ.', goods: 150000, vat: 10500 },
  { month: 'มี.ค.', goods: 140000, vat: 9800 },
  { month: 'เม.ย.', goods: 180000, vat: 12600 },
  { month: 'พ.ค.', goods: 210000, vat: 14700 },
  { month: 'มิ.ย.', goods: 250000, vat: 17500 },
];

const productData = [
  { name: 'กระดาษ A4', value: 45000 },
  { name: 'หมึกพิมพ์ Toner', value: 85000 },
  { name: 'แฟ้มเอกสาร', value: 12000 },
  { name: 'เครื่องเขียน', value: 15000 },
  { name: 'บริการซ่อม', value: 30000 },
];

const recentDocs = [
  { id: 1, number: 'INV-202606-0012', type: 'ใบกำกับภาษี', customer: 'บจก. เอบีซี', amount: 32100, date: '2 ชั่วโมงที่แล้ว', icon: FileCheck },
  { id: 2, number: 'RCP-202606-0045', type: 'ใบเสร็จรับเงิน', customer: 'ร้านมิตรภาพ', amount: 8500, date: '5 ชั่วโมงที่แล้ว', icon: Receipt },
  { id: 3, number: 'CSB-202606-0023', type: 'บิลเงินสด', customer: 'คุณสมชาย', amount: 3200, date: 'เมื่อวาน', icon: Banknote },
  { id: 4, number: 'DLV-202606-0018', type: 'ใบส่งของ', customer: 'บจก. ดีเอฟจี', amount: 67800, date: 'เมื่อวาน', icon: Truck },
];

export default function DashboardPage() {
  const { theme } = useTheme();
  const chartColors = theme === 'deep-ocean'
    ? ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']
    : ['#ea580c', '#f97316', '#fbbf24', '#fcd34d', '#fed7aa'];

  const [loading, setLoading] = useState(true);
  const [dashboardData] = useState<any>({
    revenueData,
    productData,
    recentDocs,
    kpiStats: {
      totalRevenue: 1050000,
      documentsIssued: 156,
      pendingDrafts: 8,
    }
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        // Replace with actual backend API call when ready
        // const response = await apiClient.get('/dashboard/summary');
        // setDashboardData(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleRefresh = async () => {
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: handleRefresh });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value);
  };

  const kpis = useMemo(() => [
    {
      label: 'รายได้รวม',
      value: formatCurrency(dashboardData.kpiStats.totalRevenue),
      change: '+18.5%',
      positive: true,
      icon: TrendingUp,
      desc: 'เทียบเดือนก่อน',
    },
    {
      label: 'เอกสารที่ออก',
      value: dashboardData.kpiStats.documentsIssued.toString(),
      change: '+12',
      positive: true,
      icon: FileText,
      desc: 'เดือนนี้',
    },
    {
      label: 'รอดำเนินการ',
      value: dashboardData.kpiStats.pendingDrafts.toString(),
      change: '-3',
      positive: true,
      icon: Clock,
      desc: 'เอกสารร่าง',
    },
    {
      label: 'เติบโต MoM',
      value: '+23.4%',
      change: '+5.2%',
      positive: true,
      icon: TrendingUp,
      desc: 'เทียบเดือนก่อน',
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
    exportToExcel(dashboardData.recentDocs, 'Recent_Documents', mapping);
  };

  return (
    <div className="space-y-6 relative" style={{ transform: `translateY(${pullDistance}px)` }}>
      
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
        <div className="w-1.5 h-10 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <div>
          <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text)' }}>ภาพรวมธุรกิจ</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>สรุปรายได้และเอกสารล่าสุด</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={`kpi-card relative overflow-hidden animate-fade-in-up delay-${i + 1}`} style={{ opacity: 0 }}>
            {/* Watermark Icon */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transform rotate-12">
              <kpi.icon size={80} />
            </div>
            
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
              >
                <kpi.icon size={20} />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${kpi.positive ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {kpi.change}
              </span>
            </div>
            <p className="text-2xl font-bold mb-0.5 relative z-10" style={{ color: 'var(--color-text)' }}>{kpi.value}</p>
            <p className="text-xs relative z-10" style={{ color: 'var(--color-text-muted)' }}>{kpi.label} — {kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                แนวโน้มรายได้ และ ภาษีขาย
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                มูลค่ารวมจากการออกเอกสาร 6 เดือนล่าสุด
              </p>
            </div>
            <span className="badge badge-neutral">6 เดือน</span>
          </div>
          <div style={{ height: 280 }} className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
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
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Bar dataKey="goods" name="มูลค่าสินค้า" fill="url(#colorGoods)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="vat" name="ภาษีขาย 7%" fill="url(#colorVat)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Pie Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                สัดส่วนสินค้าที่ขายดี
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Top 5 รายการจัดตามมูลค่า
              </p>
            </div>
            <span className="badge badge-neutral">จัดตามมูลค่า</span>
          </div>
          <div style={{ height: 280 }} className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
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
                  {dashboardData.productData.map((_: any, index: number) => (
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
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: any) => <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
            เอกสารล่าสุด
          </h3>
          <button className="btn btn-secondary text-xs py-1 px-3" onClick={handleExport}>
            <Download size={14} /> ส่งออก Excel
          </button>
        </div>
        <table className="data-table table-responsive">
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
            {dashboardData.recentDocs.map((doc: any) => (
              <tr key={doc.id} className="haptic-tap">
                <td data-label="เลขที่เอกสาร">
                  <div className="flex items-center gap-2">
                    <doc.icon size={16} style={{ color: 'var(--color-primary)' }} />
                    <span className="font-semibold text-sm">{doc.number}</span>
                  </div>
                </td>
                <td data-label="ประเภท"><span className="badge badge-info">{doc.type}</span></td>
                <td data-label="ลูกค้า" style={{ color: 'var(--color-text-secondary)' }}>{doc.customer}</td>
                <td data-label="จำนวนเงิน" className="text-right font-semibold">{formatCurrency(doc.amount)}</td>
                <td data-label="เวลา" className="text-right" style={{ color: 'var(--color-text-muted)' }}>{doc.date}</td>
                <td data-label="จัดการ">
                  <div className="flex items-center justify-center">
                    <button 
                      onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors haptic-tap text-gray-500 hover:text-primary" 
                      title="พิมพ์ / ออก PDF"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
