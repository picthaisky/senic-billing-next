import { useState, useEffect } from 'react';
import { Users, Building2, CreditCard, Activity, Receipt } from 'lucide-react';
import { saApiClient } from '../services/apiClient';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  mrr: number;
  recentInvoices: Array<{
    id: string;
    tenantName: string;
    planName: string;
    amount: number;
    status: string;
    startDate: string;
    endDate: string;
  }>;
}

export default function Dashboard() {
  const { locale, t } = useAdminLocale();
  const dateLocale = locale === 'th' ? 'th-TH' : 'en-US';
  const [data, setData] = useState<PlatformStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    mrr: 0,
    recentInvoices: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saApiClient
      .get('/superadmin/billing/stats')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch platform stats', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const stats = [
    {
      label: t.dashboard.totalTenantsLabel,
      value: loading ? '...' : data.totalTenants.toLocaleString(dateLocale),
      change: t.dashboard.activeTenantsChange(data.activeTenants),
      icon: Building2,
      color: 'text-blue-500',
      bg: 'bg-blue-100',
    },
    {
      label: t.dashboard.totalUsersLabel,
      value: loading ? '...' : data.totalUsers.toLocaleString(dateLocale),
      change: t.dashboard.totalUsersChange,
      icon: Users,
      color: 'text-indigo-500',
      bg: 'bg-indigo-100',
    },
    {
      label: t.dashboard.mrrLabel,
      value: loading ? '...' : `฿ ${data.mrr.toLocaleString(dateLocale)}`,
      change: t.dashboard.mrrChange,
      icon: CreditCard,
      color: 'text-emerald-500',
      bg: 'bg-emerald-100',
    },
    {
      label: t.dashboard.systemStatusLabel,
      value: '99.9%',
      change: 'Healthy',
      icon: Activity,
      color: 'text-rose-500',
      bg: 'bg-rose-100',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t.dashboard.title}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
              <p className="text-xs font-medium text-emerald-600 mt-1">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <Receipt size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">{t.dashboard.recentTxTitle}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3.5 px-6 text-sm font-semibold text-slate-600">{t.dashboard.colTenant}</th>
              <th className="py-3.5 px-6 text-sm font-semibold text-slate-600">{t.dashboard.colPlan}</th>
              <th className="py-3.5 px-6 text-sm font-semibold text-slate-600">{t.dashboard.colPeriod}</th>
              <th className="py-3.5 px-6 text-sm font-semibold text-slate-600 text-right">{t.dashboard.colAmount}</th>
              <th className="py-3.5 px-6 text-sm font-semibold text-slate-600 text-center">{t.dashboard.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.recentInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="py-4 px-6 font-medium text-slate-800">{inv.tenantName}</td>
                <td className="py-4 px-6 text-slate-600">{inv.planName}</td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  {new Date(inv.startDate).toLocaleDateString(dateLocale)} - {new Date(inv.endDate).toLocaleDateString(dateLocale)}
                </td>
                <td className="py-4 px-6 text-right font-semibold text-slate-800">
                  ฿{Number(inv.amount || 0).toLocaleString(dateLocale)}
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {data.recentInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                  {loading ? t.dashboard.loading : t.dashboard.noRecentTx}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
