import { useState, useEffect, useCallback } from 'react';
import { Search, Ban, CheckCircle } from 'lucide-react';
import { saApiClient } from '../services/apiClient';

interface TenantSummary {
  id: string;
  companyName: string;
  email?: string | null;
  currentPlanId?: string | null;
  currentPlan?: string | null;
  subscriptionStatus: string;
}

interface PlanOption {
  id: string;
  name: string;
  monthlyPrice?: number;
}

export default function TenantsList() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTenantsData = useCallback(async () => {
    const [tenantsRes, plansRes] = await Promise.all([
      saApiClient.get(`/superadmin/tenants${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`),
      saApiClient.get('/superadmin/plans'),
    ]);
    return {
      tenants: tenantsRes.data?.success ? (tenantsRes.data.data as TenantSummary[]) : null,
      plans: plansRes.data?.success ? (plansRes.data.data as PlanOption[]) : null,
    };
  }, [searchQuery]);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loadTenantsData();
      if (result.tenants) setTenants(result.tenants);
      if (result.plans) setPlans(result.plans);
    } catch (error) {
      console.error('Failed to fetch tenants', error);
    } finally {
      setLoading(false);
    }
  }, [loadTenantsData]);

  useEffect(() => {
    let active = true;
    loadTenantsData()
      .then((result) => {
        if (!active) return;
        if (result.tenants) setTenants(result.tenants);
        if (result.plans) setPlans(result.plans);
      })
      .catch((error) => {
        console.error('Failed to fetch tenants', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadTenantsData]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'Active' ? 'suspend' : 'activate';
      await saApiClient.post(`/superadmin/tenants/${id}/${action}`);
      fetchTenants();
    } catch (error) {
      console.error('Failed to toggle status', error);
    }
  };

  const handleAssignPlan = async (tenantId: string, planId: string) => {
    if (!planId) return;
    try {
      await saApiClient.put(`/superadmin/tenants/${tenantId}/plan`, { planId });
      fetchTenants();
    } catch (error) {
      console.error('Failed to assign plan', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">ผู้ใช้บริการ (Tenants)</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อบริษัท หรืออีเมล..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-72 bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">ชื่อบริษัท</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">แพ็กเกจปัจจุบัน</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">สถานะ</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6">
                  <p className="font-semibold text-slate-800">{t.companyName}</p>
                  <p className="text-sm text-slate-500">{t.email || '-'}</p>
                </td>
                <td className="py-4 px-6">
                  <select
                    aria-label="เปลี่ยนแพ็กเกจ"
                    value={t.currentPlanId || ''}
                    onChange={(e) => handleAssignPlan(t.id, e.target.value)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium focus:outline-none"
                  >
                    <option value="">{t.currentPlan || 'เลือกแพ็กเกจ'}</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (฿{Number(p.monthlyPrice || 0).toLocaleString('th-TH')})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-4 px-6">
                  {t.subscriptionStatus === 'Active' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                      <CheckCircle size={14} /> Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                      <Ban size={14} /> {t.subscriptionStatus}
                    </span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <button
                    onClick={() => toggleStatus(t.id, t.subscriptionStatus)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      t.subscriptionStatus === 'Active'
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {t.subscriptionStatus === 'Active' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่พบข้อมูลองค์กร'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
