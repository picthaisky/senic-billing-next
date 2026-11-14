import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePwaStatus } from '../../hooks/usePwaStatus';

export function PwaStatusBanners() {
  const { t } = useTranslation();
  const {
    isOnline,
    canInstall,
    hasUpdate,
    isBannerDismissed,
    installApp,
    dismissInstallBanner,
    applyUpdate,
  } = usePwaStatus();

  const showInstallBanner = canInstall && !isBannerDismissed;

  if (isOnline && !hasUpdate && !showInstallBanner) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2.5" role="region" aria-label={t('pwa.statusRegionAria')}>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--color-text)]"
        >
          <div className="flex items-start gap-2.5">
            <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold leading-snug">{t('pwa.offlineTitle')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('pwa.offlineDesc')}</p>
            </div>
          </div>
        </div>
      )}

      {hasUpdate && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-primary)]/35 bg-[var(--color-primary-soft)] px-4 py-2.5 text-sm text-[var(--color-text)]"
        >
          <div className="flex items-center gap-2.5">
            <RefreshCw size={18} className="shrink-0 text-[var(--color-primary)]" />
            <span className="font-medium">{t('pwa.updateTitle')}</span>
          </div>
          <button
            type="button"
            onClick={applyUpdate}
            className="touch-target inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white transition-transform active:scale-95"
          >
            <RefreshCw size={14} />
            <span>{t('pwa.updateAction')}</span>
          </button>
        </div>
      )}

      {showInstallBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-solid)] px-4 py-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Download size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t('pwa.installBannerTitle')}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t('pwa.installBannerDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismissInstallBanner}
              className="touch-target inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
              aria-label={t('pwa.dismiss')}
            >
              <X size={14} />
              <span>{t('pwa.dismiss')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void installApp();
              }}
              className="touch-target inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
            >
              <Download size={14} />
              <span>{t('pwa.installAction')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
