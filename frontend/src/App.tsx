import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './components/auth/LoginPage';
import { useAuthStore } from './store/useAuthStore';

const DocumentPrintView = lazy(() => import('./pages/DocumentPrintView'));
const PaymentCallbackPage = lazy(() => import('./pages/PaymentCallbackPage'));
const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'));
const CustomersPage = lazy(() => import('./components/customers/CustomersPage'));
const ProductsPage = lazy(() => import('./components/products/ProductsPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const UsersManagementPage = lazy(() => import('./components/users/UsersManagementPage'));
const AuditLogsPage = lazy(() => import('./components/users/AuditLogsPage'));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage'));
const InvoiceForm = lazy(() => import('./components/forms/InvoiceForm'));
const DocumentsListPage = lazy(() => import('./components/documents/DocumentsListPage'));
const ExpensesPage = lazy(() => import('./components/expenses/ExpensesPage'));
const PurchaseOrdersPage = lazy(() => import('./components/purchasing/PurchaseOrdersPage'));
const WarehousesPage = lazy(() => import('./components/warehouses/WarehousesPage'));
const AccountingPage = lazy(() => import('./components/accounting/AccountingPage'));
const BankReconciliationPage = lazy(() => import('./components/accounting/BankReconciliationPage'));

function PageLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[45vh] flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      <span className="text-sm font-medium">{t('common.loadingPage')}</span>
    </div>
  );
}

// Wrapper for InvoiceForm to pass documentType and title based on URL parameter
function InvoiceFormWrapper() {
  const { t } = useTranslation();
  const { type, id } = useParams<{ type: string; id?: string }>();
  const supportedDocTypes = ['taxinvoice', 'receipt', 'cashbill', 'delivery', 'quotation', 'creditnote', 'debitnote'] as const;
  const docKey = supportedDocTypes.includes((type || '') as (typeof supportedDocTypes)[number])
    ? type!
    : '';
  const baseTitle = docKey ? t(`docType.${docKey}`) : t('forms.genericDocument');
  const title = id
    ? t('forms.editTitle', { label: baseTitle })
    : t('forms.createTitle', { label: baseTitle });
  return <InvoiceForm key={type} documentType={type || 'receipt'} title={title} documentId={id} />;
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
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/print/:id" element={<DocumentPrintView />} />
          <Route path="/payments/callback" element={<PaymentCallbackPage />} />
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
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="accounting" element={<AccountingPage />} />
            <Route path="bank-reconciliation" element={<BankReconciliationPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersManagementPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="staff" element={<Navigate to="/users" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="documents/:type" element={<DocumentsListPage />} />
            <Route path="documents/:type/create" element={<InvoiceFormWrapper />} />
            <Route path="documents/:type/edit/:id" element={<InvoiceFormWrapper />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
