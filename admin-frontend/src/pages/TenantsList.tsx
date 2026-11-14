import { useState, useEffect, useCallback } from 'react';
import { Search, Ban, CheckCircle, ExternalLink, Users, FileText } from 'lucide-react';
import { saApiClient } from '../services/apiClient';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface TenantSummary {
  id: string;
  companyName: string;
  email?: string | null;
  currentPlanId?: string | null;
  currentPlan?: string | null;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  userCount: number;
  documentsCreatedThisMonth: number;
  subscriptionStatus: string;
}

interface PlanOption {
  id: string;
  name: string;
  monthlyPrice?: number;
}

function formatQuotaLabel(used: number, max: number, unlimitedLabel: string): string {
  return max < 0 ? `${used} / ${unlimitedLabel}` : `${used} / ${max}`;
}

function computeQuotaPercent(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export default function TenantsList() {
  const { locale, t } = useAdminLocale();
  const numLocale = locale === 'th' ? 'th-TH' : 'en-US';
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

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

  const handleImpersonate = async (tenant: TenantSummary) => {
    try {
      setImpersonatingId(tenant.id);
      setNotice('');
      const res = await saApiClient.post(`/superadmin/tenants/${tenant.id}/impersonate`);
      const token = res.data?.data?.token as string | undefined;
      if (!token) {
        setNotice(t.tenants.impersonateMissingToken);
        return;
      }

      const configuredFrontendUrl = res.data?.data?.frontendUrl as string | undefined;
      const smeBaseUrl = configuredFrontendUrl
        || (import.meta.env.VITE_FRONTEND_URL as string | undefined)
        || 'http://localhost:5173';
      const targetUrl = `${smeBaseUrl.replace(/\/$/, '')}/login#impersonate=${encodeURIComponent(token)}`;
      const win = window.open(targetUrl, '_blank', 'noopener');
      if (!win) {
        await navigator.clipboard?.writeText(targetUrl).catch(() => {});
        setNotice(t.tenants.impersonateCopiedNotice(tenant.companyName));
      } else {
        setNotice(t.tenants.impersonateOpenedNotice(tenant.companyName));
      }
    } catch (error) {
      console.error('Impersonation failed', error);
      setNotice(t.tenants.impersonateFailedNotice(tenant.companyName));
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t.tenants.title}</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.tenants.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-72 bg-white"
          />
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.tenants.colOrg}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.tenants.colPlan}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.tenants.colUsage}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.tenants.colStatus}</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">{t.tenants.colManage}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((tenant) => {
              const userPct = computeQuotaPercent(tenant.userCount ?? 0, tenant.maxUsers ?? -1);
              const docPct = computeQuotaPercent(tenant.documentsCreatedThisMonth ?? 0, tenant.maxDocumentsPerMonth ?? -1);
              return (
                <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-800">{tenant.companyName}</p>
                    <p className="text-sm text-slate-500">{tenant.email || '-'}</p>
                  </td>
                  <td className="py-4 px-6">
                    <select
                      aria-label={t.tenants.selectPlanLabel}
                      value={tenant.currentPlanId || ''}
                      onChange={(e) => handleAssignPlan(tenant.id, e.target.value)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium focus:outline-none"
                    >
                      <option value="">{tenant.currentPlan || t.tenants.selectPlanLabel}</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (฿{Number(p.monthlyPrice || 0).toLocaleString(numLocale)})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4 px-6 min-w-[220px]">
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-600 mb-0.5">
                          <span className="flex items-center gap-1"><Users size={12} /> {t.tenants.usersShort}</span>
                          <span className="font-medium tabular-nums">
                            {formatQuotaLabel(tenant.userCount ?? 0, tenant.maxUsers ?? -1, t.tenants.unlimited)}
                          </span>
                        </div>
                        {tenant.maxUsers > 0 && (
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${userPct >= 90 ? 'bg-rose-500' : 'bg-blue-500'}`}
                              style={{ width: `${userPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-600 mb-0.5">
                          <span className="flex items-center gap-1"><FileText size={12} /> {t.tenants.docsShort}</span>
                          <span className="font-medium tabular-nums">
                            {formatQuotaLabel(tenant.documentsCreatedThisMonth ?? 0, tenant.maxDocumentsPerMonth ?? -1, t.tenants.unlimited)}
                          </span>
                        </div>
                        {tenant.maxDocumentsPerMonth > 0 && (
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${docPct >= 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${docPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {tenant.subscriptionStatus === 'Active' ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                        <CheckCircle size={14} /> Active
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                        <Ban size={14} /> {tenant.subscriptionStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(tenant)}
                        disabled={impersonatingId === tenant.id}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={14} />
                        {impersonatingId === tenant.id ? t.tenants.impersonatingBtn : t.tenants.impersonateBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(tenant.id, tenant.subscriptionStatus)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tenant.subscriptionStatus === 'Active'
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {tenant.subscriptionStatus === 'Active' ? t.tenants.suspendBtn : t.tenants.activateBtn}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  {loading ? t.tenants.loading : t.tenants.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
