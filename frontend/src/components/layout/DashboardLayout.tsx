import { useState, useEffect } from 'react';
import { signalRClient } from '../../services/signalrClient';
import { apiClient } from '../../services/apiClient';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import FloatingAIChat from './FloatingAIChat';
import { PwaStatusBanners } from '../pwa/PwaStatusBanners';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { Megaphone, AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface ActiveAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Critical' | string;
}

const DISMISSED_KEY = 'senic_dismissed_announcements';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [announcements, setAnnouncements] = useState<ActiveAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    signalRClient.connect();
    return () => {
      signalRClient.disconnect();
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/announcements/active')
      .then((res) => {
        if (active && res.data?.success && Array.isArray(res.data?.data)) {
          setAnnouncements(res.data.data as ActiveAnnouncement[]);
        }
      })
      .catch(() => {
        // Non-blocking platform announcements fetch
      });
    return () => {
      active = false;
    };
  }, []);

  const dismissAnnouncement = (id: string) => {
    setDismissedIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return t('pageTitles.dashboard');
    if (path.startsWith('/customers')) return t('pageTitles.customers');
    if (path.startsWith('/products')) return t('pageTitles.products');
    if (path.startsWith('/expenses')) return t('pageTitles.expenses');
    if (path.startsWith('/purchase-orders')) return t('pageTitles.purchaseOrders');
    if (path.startsWith('/warehouses')) return t('pageTitles.warehouses');
    if (path.startsWith('/accounting')) return t('pageTitles.accounting');
    if (path.startsWith('/bank-reconciliation')) return t('pageTitles.bankReconciliation');
    if (path.startsWith('/settings')) return t('pageTitles.settings');
    if (path.startsWith('/users')) return t('pageTitles.users');
    if (path.startsWith('/audit-logs')) return t('pageTitles.auditLogs');
    if (path.startsWith('/help')) return t('pageTitles.help');
    if (path.startsWith('/profile')) return t('pageTitles.profile');
    if (path.startsWith('/documents/receipt')) return t('pageTitles.receipt');
    if (path.startsWith('/documents/cashbill')) return t('pageTitles.cashbill');
    if (path.startsWith('/documents/delivery')) return t('pageTitles.delivery');
    if (path.startsWith('/documents/quotation')) return t('pageTitles.quotation');
    if (path.startsWith('/documents/taxinvoice')) return t('pageTitles.taxinvoice');
    if (path.startsWith('/documents/creditnote')) return t('pageTitles.creditnote');
    if (path.startsWith('/documents/debitnote')) return t('pageTitles.debitnote');
    return 'Senic Billing Next';
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));

  const getSeverityStyles = (severity: string) => {
    if (severity === 'Critical') {
      return {
        wrapper: 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200',
        Icon: ShieldAlert,
      };
    }
    if (severity === 'Warning') {
      return {
        wrapper: 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200',
        Icon: AlertTriangle,
      };
    }
    return {
      wrapper: 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200',
      Icon: Megaphone,
    };
  };

  return (
    <div className="min-h-screen dashboard-root">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </div>

      {/* Main content — offset by sidebar on desktop */}
      <div className={`dashboard-main-shell ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
        <Header pageTitle={getPageTitle()} />
        <main className="app-main-content flex-1">
          <div className="app-page-container animate-fade-in-up">
            <PwaStatusBanners />
            {visibleAnnouncements.length > 0 && (
              <div className="space-y-2 mb-5" role="region" aria-label={t('header.announcementRegionAria')}>
                {visibleAnnouncements.map((item) => {
                  const { wrapper, Icon } = getSeverityStyles(item.severity);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${wrapper}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon size={18} className="shrink-0 mt-0.5" />
                        <div className="text-sm leading-snug">
                          <span className="font-semibold mr-1.5">{item.title}:</span>
                          <span>{item.message}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissAnnouncement(item.id)}
                        aria-label={t('header.dismissAnnouncement', { title: item.title })}
                        className="p-1 rounded-lg hover:bg-black/5 shrink-0"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden">
        <BottomNav />
        <FloatingActionButton />
      </div>

      <FloatingAIChat />
    </div>
  );
}
