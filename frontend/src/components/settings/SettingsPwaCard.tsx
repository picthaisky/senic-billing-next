import { CheckCircle2, Download, RefreshCw, Share, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePwaStatus } from '../../hooks/usePwaStatus';

export default function SettingsPwaCard() {
  const { t } = useTranslation();
  const {
    isOnline,
    isStandalone,
    canInstall,
    isIosSafariInstallable,
    hasUpdate,
    installApp,
    applyUpdate,
  } = usePwaStatus();

  return (
    <div className="card form-section-card p-6 md:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
            <Smartphone size={20} className="text-[var(--color-primary)]" />
            {t('pwa.settingsCardTitle')}
          </h3>
          <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
            {t('pwa.settingsCardDesc')}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium border ${
            isOnline
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? t('pwa.connectionOnline') : t('pwa.connectionOffline')}</span>
        </span>
      </div>

      <div className="p-4 border rounded-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
        <div className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
          {isStandalone ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium text-[var(--color-text)]">{t('pwa.installedStatus')}</span>
            </>
          ) : canInstall ? (
            <>
              <Download size={18} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
              <span className="font-medium text-[var(--color-text)]">{t('pwa.readyStatus')}</span>
            </>
          ) : isIosSafariInstallable ? (
            <>
              <Share size={18} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
              <span>{t('pwa.iosGuide')}</span>
            </>
          ) : (
            <span>{t('pwa.browserHint')}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {hasUpdate && (
            <button
              type="button"
              onClick={applyUpdate}
              className="btn btn-secondary touch-target text-sm"
            >
              <RefreshCw size={15} />
              <span>{t('pwa.updateAction')}</span>
            </button>
          )}
          {canInstall && (
            <button
              type="button"
              onClick={() => {
                void installApp();
              }}
              className="btn btn-primary touch-target text-sm"
            >
              <Download size={15} />
              <span>{t('pwa.installAction')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
