import { useState } from 'react';
import { Archive, Download, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/errorUtils';

export default function TenantBackupCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SystemAdmin';
  const [downloading, setDownloading] = useState(false);

  if (!isAdmin) return null;

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await apiClient.get('/tenants/backup/export', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `SenicBilling_Backup_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, t('backup.exportError')));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card form-section-card p-6 md:p-8 space-y-6">
      <div>
        <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
          <Archive size={20} className="text-[var(--color-primary)]" />
          {t('backup.title')}
        </h3>
        <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
          {t('backup.subtitle')}
        </p>
      </div>

      <div className="p-4 border rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
        <div className="flex items-start gap-3 text-xs text-[var(--color-text-muted)]">
          <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-[var(--color-text)]">{t('backup.adminOnly')}</p>
            <p className="mt-0.5">
              {t('backup.isolationNote')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleDownloadBackup()}
          disabled={downloading}
          className="btn btn-primary shrink-0 flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={16} />
          {downloading ? t('backup.downloading') : t('backup.downloadBtn')}
        </button>
      </div>
    </div>
  );
}

