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

const pageTitles: Record<string, string> = {
  dashboard: 'แดชบอร์ด',
  receipt: 'ใบเสร็จรับเงิน',
  cashbill: 'บิลเงินสด',
  delivery: 'ใบส่งของ',
  taxinvoice: 'ใบกำกับภาษี',
  customers: 'จัดการลูกค้า',
  products: 'จัดการสินค้า',
  settings: 'ตั้งค่าระบบ',
  profile: 'โปรไฟล์ของฉัน',
};

export default function DashboardLayout() {
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

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'taxinvoice':
        return <InvoiceForm key="taxinvoice" documentType="taxinvoice" title="สร้างใบกำกับภาษีใหม่" />;
      case 'receipt':
        return <InvoiceForm key="receipt" documentType="receipt" title="สร้างใบเสร็จรับเงินใหม่" />;
      case 'cashbill':
        return <InvoiceForm key="cashbill" documentType="cashbill" title="สร้างบิลเงินสดใหม่" />;
      case 'delivery':
        return <InvoiceForm key="delivery" documentType="delivery" title="สร้างใบส่งของใหม่" />;
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
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
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'}`}>
        <Header 
          pageTitle={pageTitles[currentPage] || 'Senic Billing Next'} 
          onNavigate={setCurrentPage} 
        />
        <main className="px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6 lg:px-8">
          <div className="w-full max-w-[1440px] mx-auto animate-fade-in-up">
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
