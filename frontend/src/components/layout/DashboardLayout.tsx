import { useState, useEffect } from 'react';
import { signalRClient } from '../../services/signalrClient';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import FloatingAIChat from './FloatingAIChat';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
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

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return t('pageTitles.dashboard');
    if (path.startsWith('/customers')) return t('pageTitles.customers');
    if (path.startsWith('/products')) return t('pageTitles.products');
    if (path.startsWith('/settings')) return t('pageTitles.settings');
    if (path.startsWith('/profile')) return t('pageTitles.profile');
    if (path.startsWith('/documents/receipt')) return t('pageTitles.receipt');
    if (path.startsWith('/documents/cashbill')) return t('pageTitles.cashbill');
    if (path.startsWith('/documents/delivery')) return t('pageTitles.delivery');
    if (path.startsWith('/documents/quotation')) return t('pageTitles.quotation');
    if (path.startsWith('/documents/taxinvoice')) return t('pageTitles.taxinvoice');
    return 'Senic Billing Next';
  };

  return (
    <div className="min-h-screen dashboard-root">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar 
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </div>

      {/* Main content — offset by sidebar on desktop */}
      <div
        className={`dashboard-main-shell ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}
      >
        <Header pageTitle={getPageTitle()} />
        <main className="app-main-content flex-1">
          <div className="app-page-container animate-fade-in-up">
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
