import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Edit2, Trash2, X } from 'lucide-react';
import { saApiClient } from '../services/apiClient';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Critical' | string;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

interface AnnouncementForm {
  id?: string;
  title: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Critical';
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

export default function AnnouncementsPage() {
  const { locale, t } = useAdminLocale();
  const dateLocale = locale === 'th' ? 'th-TH' : 'en-US';
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>({
    title: '',
    message: '',
    severity: 'Info',
    isActive: true,
    startsAt: '',
    endsAt: '',
  });

  const loadAnnouncements = useCallback(async (): Promise<AnnouncementItem[] | null> => {
    const res = await saApiClient.get('/superadmin/announcements');
    return res.data?.success ? (res.data.data as AnnouncementItem[]) : null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await loadAnnouncements();
      if (data) setItems(data);
    } catch (error) {
      console.error('Failed to load announcements', error);
    }
  }, [loadAnnouncements]);

  useEffect(() => {
    let active = true;
    loadAnnouncements()
      .then((data) => {
        if (active && data) setItems(data);
      })
      .catch((error) => {
        console.error('Failed to load announcements', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAnnouncements]);

  const openCreate = () => {
    setForm({
      title: '',
      message: '',
      severity: 'Info',
      isActive: true,
      startsAt: '',
      endsAt: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setForm({
      id: item.id,
      title: item.title,
      message: item.message,
      severity: (item.severity === 'Warning' || item.severity === 'Critical' ? item.severity : 'Info'),
      isActive: item.isActive,
      startsAt: item.startsAt ? item.startsAt.slice(0, 10) : '',
      endsAt: item.endsAt ? item.endsAt.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        message: form.message,
        severity: form.severity,
        isActive: form.isActive,
        startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00Z`).toISOString() : null,
        endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59Z`).toISOString() : null,
      };
      if (form.id) {
        await saApiClient.put(`/superadmin/announcements/${form.id}`, payload);
      } else {
        await saApiClient.post('/superadmin/announcements', payload);
      }
      setModalOpen(false);
      await refresh();
    } catch (error) {
      console.error('Failed to save announcement', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await saApiClient.delete(`/superadmin/announcements/${id}`);
      await refresh();
    } catch (error) {
      console.error('Failed to delete announcement', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'Critical') return 'bg-rose-100 text-rose-700';
    if (severity === 'Warning') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="text-blue-600" size={24} />
            {t.announcements.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.announcements.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium inline-flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} /> {t.announcements.createBtn}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getSeverityBadge(item.severity)}`}>
                  {item.severity}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.isActive ? t.announcements.statusActive : t.announcements.statusClosed}
                </span>
                <h2 className="font-bold text-slate-800 text-base">{item.title}</h2>
              </div>
              <p className="text-sm text-slate-600">{item.message}</p>
              <p className="text-xs text-slate-400">
                {t.announcements.createdAtPrefix} {new Date(item.createdAt).toLocaleString(dateLocale)}
                {item.startsAt ? ` • ${t.announcements.startsAtPrefix} ${new Date(item.startsAt).toLocaleDateString(dateLocale)}` : ''}
                {item.endsAt ? ` • ${t.announcements.endsAtPrefix} ${new Date(item.endsAt).toLocaleDateString(dateLocale)}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                title={t.announcements.editTitle}
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                title={t.announcements.deleteTitle}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-500">
            {loading ? t.announcements.loading : t.announcements.empty}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {form.id ? t.announcements.modalEditTitle : t.announcements.modalCreateTitle}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.announcements.titleLabel}</label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.announcements.messageLabel}</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.announcements.severityLabel}</label>
                  <select
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.severity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, severity: e.target.value as 'Info' | 'Warning' | 'Critical' }))
                    }
                  >
                    <option value="Info">{t.announcements.severityInfo}</option>
                    <option value="Warning">{t.announcements.severityWarning}</option>
                    <option value="Critical">{t.announcements.severityCritical}</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {t.announcements.activeCheckboxLabel}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.announcements.startsAtLabel}</label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.announcements.endsAtLabel}</label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  {t.announcements.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {saving ? t.announcements.savingBtn : t.announcements.saveBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

