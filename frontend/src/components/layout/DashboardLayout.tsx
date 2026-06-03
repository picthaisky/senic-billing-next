import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardPage from '../dashboard/DashboardPage';
import InvoiceForm from '../forms/InvoiceForm';

const pageTitles: Record<string, string> = {
  dashboard: 'แดชบอร์ด',
  receipt: 'ใบเสร็จรับเงิน',
  cashbill: 'บิลเงินสด',
  delivery: 'ใบส่งของ',
  taxinvoice: 'ใบกำกับภาษี',
  customers: 'จัดการลูกค้า',
  products: 'จัดการสินค้า',
  settings: 'ตั้งค่าระบบ',
};

export default function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'taxinvoice':
        return <InvoiceForm documentType="taxinvoice" title="สร้างใบกำกับภาษีใหม่" />;
      case 'receipt':
        return <InvoiceForm documentType="receipt" title="สร้างใบเสร็จรับเงินใหม่" />;
      case 'cashbill':
        return <InvoiceForm documentType="cashbill" title="สร้างบิลเงินสดใหม่" />;
      case 'delivery':
        return <InvoiceForm documentType="delivery" title="สร้างใบส่งของใหม่" />;
      case 'customers':
        return <PlaceholderPage icon="👥" title="จัดการลูกค้า" desc="ค้นหา เพิ่ม แก้ไขข้อมูลลูกค้า" />;
      case 'products':
        return <PlaceholderPage icon="📦" title="จัดการสินค้า" desc="ค้นหา เพิ่ม แก้ไขข้อมูลสินค้าและบริการ" />;
      case 'settings':
        return <PlaceholderPage icon="⚙️" title="ตั้งค่าระบบ" desc="ธีม, ข้อมูลบริษัท, ผู้ใช้งาน" />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header pageTitle={pageTitles[currentPage] || 'Senic Billing Next'} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function PlaceholderPage({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-6xl mb-6">{icon}</div>
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        ✨ ระบบนี้พร้อมเชื่อมต่อกับ Backend API
      </p>
    </div>
  );
}
