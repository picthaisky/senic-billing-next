import { useState, useEffect, useCallback } from 'react';
import { Search, Ban, CheckCircle, ExternalLink, Users, FileText, Plus, X } from 'lucide-react';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    adminUsername: '',
    adminPassword: '',
    adminDisplayName: '',
    planId: '',
  });

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

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      await saApiClient.post('/superadmin/tenants', {
        companyName: createForm.companyName,
        taxId: createForm.taxId || null,
        email: createForm.email || null,
        phone: createForm.phone || null,
        address: createForm.address || null,
        adminUsername: createForm.adminUsername,
        adminPassword: createForm.adminPassword,
        adminDisplayName: createForm.adminDisplayName || null,
        planId: createForm.planId || null,
      });
      await loadTenantsData();
      setNotice(t.tenants.createSuccessNotice(createForm.companyName));
      setShowCreateModal(false);
      setCreateForm({
        companyName: '',
        taxId: '',
        email: '',
        phone: '',
        address: '',
        adminUsername: '',
        adminPassword: '',
        adminDisplayName: '',
        planId: '',
      });
    } catch (error) {
      console.error('Create tenant failed', error);
      setNotice(t.tenants.createFailedNotice);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t.tenants.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.tenants.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72 bg-white min-h-[44px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={18} /> {t.tenants.createBtn}
          </button>
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{t.tenants.createModalTitle}</h2>
              <button
                type="button"
                aria-label={t.tenants.cancelBtn}
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.companyNameLabel}</label>
                <input
                  type="text"
                  required
                  value={createForm.companyName}
                  onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.taxIdLabel}</label>
                  <input
                    type="text"
                    maxLength={13}
                    value={createForm.taxId}
                    onChange={(e) => setCreateForm({ ...createForm, taxId: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.emailLabel}</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.phoneLabel}</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.planLabel}</label>
                  <select
                    aria-label={t.tenants.planLabel}
                    value={createForm.planId}
                    onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">{t.tenants.selectPlanLabel}</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.addressLabel}</label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.adminUsernameLabel}</label>
                  <input
                    type="text"
                    required
                    value={createForm.adminUsername}
                    onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.adminPasswordLabel}</label>
                  <input
                    type="password"
                    required
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t.tenants.adminDisplayNameLabel}</label>
                <input
                  type="text"
                  value={createForm.adminDisplayName}
                  onChange={(e) => setCreateForm({ ...createForm, adminDisplayName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  {t.tenants.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {isCreating ? t.tenants.creatingBtn : t.tenants.createSubmitBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
