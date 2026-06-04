import { useState, useEffect } from 'react';
import { signalRClient } from '../../services/signalrClient';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import DashboardPage from '../dashboard/DashboardPage';
import InvoiceForm from '../forms/InvoiceForm';
import CustomersPage from '../customers/CustomersPage';
import ProductsPage from '../products/ProductsPage';
import SettingsPage from '../settings/SettingsPage';
import ProfilePage from '../profile/ProfilePage';
import { useTranslation } from 'react-i18next';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState('dashboard');
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

  const pageTitles: Record<string, string> = {
    dashboard: t('pageTitles.dashboard'),
    receipt: t('pageTitles.receipt'),
    cashbill: t('pageTitles.cashbill'),
    delivery: t('pageTitles.delivery'),
    quotation: t('pageTitles.quotation'),
    taxinvoice: t('pageTitles.taxinvoice'),
    customers: t('pageTitles.customers'),
    products: t('pageTitles.products'),
    settings: t('pageTitles.settings'),
    profile: t('pageTitles.profile'),
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'taxinvoice':
        return <InvoiceForm key="taxinvoice" documentType="taxinvoice" title={t('forms.createTaxinvoice')} />;
      case 'receipt':
        return <InvoiceForm key="receipt" documentType="receipt" title={t('forms.createReceipt')} />;
      case 'cashbill':
        return <InvoiceForm key="cashbill" documentType="cashbill" title={t('forms.createCashbill')} />;
      case 'delivery':
        return <InvoiceForm key="delivery" documentType="delivery" title={t('forms.createDelivery')} />;
      case 'quotation':
        return <InvoiceForm key="quotation" documentType="quotation" title={t('forms.createQuotation')} />;
      case 'customers':
        return <CustomersPage key="customers" />;
      case 'products':
        return <ProductsPage key="products" />;
      case 'settings':
        return <SettingsPage key="settings" />;
      case 'profile':
        return <ProfilePage key="profile" />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen dashboard-root">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={setCurrentPage} 
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </div>

      {/* Main content — offset by sidebar on desktop */}
      <div
        className={`dashboard-main-shell ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}
      >
        <Header 
          pageTitle={pageTitles[currentPage] || 'Senic Billing Next'} 
          onNavigate={setCurrentPage} 
        />
        <main className="app-main-content flex-1">
          <div key={currentPage} className="app-page-container animate-fade-in-up">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Floating Action Button (mobile only) */}
      <FloatingActionButton currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}
