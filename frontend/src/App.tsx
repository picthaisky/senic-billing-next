import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './components/auth/LoginPage';
import DocumentPrintView from './pages/DocumentPrintView';
import { useAuthStore } from './store/useAuthStore';
import DashboardPage from './components/dashboard/DashboardPage';
import CustomersPage from './components/customers/CustomersPage';
import ProductsPage from './components/products/ProductsPage';
import SettingsPage from './components/settings/SettingsPage';
import ProfilePage from './components/profile/ProfilePage';
import InvoiceForm from './components/forms/InvoiceForm';
import DocumentsListPage from './components/documents/DocumentsListPage';

import React from 'react';

// Wrapper for InvoiceForm to pass documentType and title based on URL parameter
function InvoiceFormWrapper() {
  const { type } = useParams<{ type: string }>();
  const titles: Record<string, string> = {
    taxinvoice: 'ใบกำกับภาษี',
    receipt: 'ใบเสร็จรับเงิน',
    cashbill: 'บิลเงินสด',
    delivery: 'ใบส่งของ',
    quotation: 'ใบเสนอราคา',
  };
  const title = titles[type || ''] || 'สร้างเอกสาร';
  return <InvoiceForm key={type} documentType={type || 'receipt'} title={title} />;
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/print/:id" 
          element={
            <ProtectedRoute>
              <DocumentPrintView />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="documents/:type" element={<DocumentsListPage />} />
          <Route path="documents/:type/create" element={<InvoiceFormWrapper />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
