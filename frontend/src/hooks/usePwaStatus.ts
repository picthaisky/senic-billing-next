import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const INSTALL_DISMISSED_KEY = 'senic-pwa-install-dismissed';

const isRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
};

const detectIosSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/i.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return !isOtherIosBrowser && /Safari/i.test(ua);
};

let waitingWorkerRef: ServiceWorker | null = null;
const waitingListeners = new Set<(worker: ServiceWorker | null) => void>();

const notifyWaitingListeners = (worker: ServiceWorker | null) => {
  waitingWorkerRef = worker;
  waitingListeners.forEach((listener) => listener(worker));
};

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Register SW in production builds or preview/nginx hosts (skip Vite dev HMR server)
  if (!import.meta.env.PROD) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyWaitingListeners(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notifyWaitingListeners(registration.waiting || installing);
        }
      });
    });

    return registration;
  } catch (err) {
    console.warn('[PWA] Service worker registration failed:', err);
    return null;
  }
}

export function usePwaStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isRunningStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(() => waitingWorkerRef);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isIosSafari] = useState<boolean>(() => detectIosSafari());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    const displayMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => setIsStandalone(isRunningStandalone());

    waitingListeners.add(setWaitingWorker);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then((reg) => {
        if (reg?.waiting && navigator.serviceWorker.controller) {
          notifyWaitingListeners(reg.waiting);
        }
      }).catch(() => undefined);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayMedia.addEventListener?.('change', handleDisplayChange);

    return () => {
      waitingListeners.delete(setWaitingWorker);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayMedia.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
    return outcome;
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setIsBannerDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // ignore storage failures
    }
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange, { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  return {
    isOnline,
    isStandalone,
    canInstall: Boolean(deferredPrompt) && !isStandalone,
    isIosSafariInstallable: isIosSafari && !isStandalone,
    hasUpdate: Boolean(waitingWorker),
    isBannerDismissed,
    installApp,
    dismissInstallBanner,
    applyUpdate,
  };
}
