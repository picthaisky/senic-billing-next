import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Package, X } from 'lucide-react';
import { saApiClient } from '../services/apiClient';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface PlanDto {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  features: string;
  isActive: boolean;
}

interface PlanFormState {
  id?: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  features: string;
  isActive: boolean;
}

export default function PackagesList() {
  const { t } = useAdminLocale();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PlanFormState>({
    name: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxUsers: 5,
    maxDocumentsPerMonth: 300,
    features: '["ออกเอกสารครบทุกประเภท", "PromptPay QR", "รายงานภาษีขาย Excel"]',
    isActive: true,
  });

  const loadPlans = useCallback(async (): Promise<PlanDto[] | null> => {
    const res = await saApiClient.get('/superadmin/plans');
    return res.data?.success ? (res.data.data as PlanDto[]) : null;
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await loadPlans();
      if (data) setPlans(data);
    } catch (error) {
      console.error('Failed to fetch plans', error);
    }
  }, [loadPlans]);

  useEffect(() => {
    let active = true;
    loadPlans()
      .then((data) => {
        if (active && data) setPlans(data);
      })
      .catch((error) => {
        console.error('Failed to fetch plans', error);
      });
    return () => {
      active = false;
    };
  }, [loadPlans]);

  const openCreateModal = () => {
    setFormData({
      name: '',
      monthlyPrice: 390,
      yearlyPrice: 3900,
      maxUsers: 5,
      maxDocumentsPerMonth: 300,
      features: '["ออกเอกสารครบทุกประเภท", "PromptPay QR", "รายงานภาษีขาย Excel"]',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (plan: PlanDto) => {
    setFormData({
      id: plan.id,
      name: plan.name || '',
      monthlyPrice: Number(plan.monthlyPrice || 0),
      yearlyPrice: Number(plan.yearlyPrice || 0),
      maxUsers: Number(plan.maxUsers || 5),
      maxDocumentsPerMonth: Number(plan.maxDocumentsPerMonth || 300),
      features: plan.features || '[]',
      isActive: Boolean(plan.isActive ?? true),
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.id) {
        await saApiClient.put(`/superadmin/plans/${formData.id}`, formData);
      } else {
        await saApiClient.post('/superadmin/plans', formData);
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (error) {
      console.error('Failed to save plan', error);
      alert(t.packages.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.packages.title}</h1>
          <p className="text-slate-500 mt-1">{t.packages.subtitle}</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={20} /> {t.packages.createBtn}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            {!plan.isActive && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-md">
                Inactive
              </div>
            )}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">฿{Number(plan.monthlyPrice || 0).toLocaleString()}</span>
                <span className="text-slate-500 font-medium">{t.packages.perMonth}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{t.packages.yearlyLine(Number(plan.yearlyPrice || 0).toLocaleString())}</p>
            </div>

            <div className="p-6 flex-1 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{t.packages.maxUsersLabel}</span>
                <span className="font-semibold text-slate-800">
                  {plan.maxUsers === -1 ? t.packages.unlimited : `${plan.maxUsers} ${t.packages.usersSuffix}`}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{t.packages.maxDocsLabel}</span>
                <span className="font-semibold text-slate-800">
                  {plan.maxDocumentsPerMonth === -1 ? t.packages.unlimited : `${plan.maxDocumentsPerMonth} ${t.packages.docsSuffix}`}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => openEditModal(plan)}
                className="w-full flex justify-center items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors py-2"
              >
                <Edit2 size={16} /> {t.packages.editBtn}
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500">{t.packages.empty}</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                {formData.id ? t.packages.modalEditTitle : t.packages.modalCreateTitle}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.planNameLabel}</label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.monthlyPriceLabel}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                    value={formData.monthlyPrice}
                    onChange={(e) => setFormData({ ...formData, monthlyPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.yearlyPriceLabel}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                    value={formData.yearlyPrice}
                    onChange={(e) => setFormData({ ...formData, yearlyPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.maxUsersInputLabel}</label>
                  <input
                    type="number"
                    min={-1}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.maxDocsInputLabel}</label>
                  <input
                    type="number"
                    min={-1}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                    value={formData.maxDocumentsPerMonth}
                    onChange={(e) => setFormData({ ...formData, maxDocumentsPerMonth: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.packages.featuresInputLabel}</label>
                <textarea
                  rows={3}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                {t.packages.activeCheckboxLabel}
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {t.packages.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {saving ? t.packages.savingBtn : t.packages.saveBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
