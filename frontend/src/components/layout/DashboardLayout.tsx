import { useState, useEffect } from 'react';
import { signalRClient } from '../../services/signalrClient';
import Sidebar from './Sidebar';
import Header from './Header';
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          pageTitle={pageTitles[currentPage] || 'Senic Billing Next'} 
          onNavigate={setCurrentPage} 
        />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="w-full mx-auto animate-fade-in-up">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
