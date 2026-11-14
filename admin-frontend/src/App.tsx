import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ShieldCheck, LogOut, Globe, Menu, WifiOff } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import TenantsList from './pages/TenantsList';
import PackagesList from './pages/PackagesList';
import BillingInvoices from './pages/BillingInvoices';
import AnnouncementsPage from './pages/AnnouncementsPage';
import Sidebar from './components/Sidebar';
import { saApiClient } from './services/apiClient';
import { useAdminLocale } from './i18n/AdminLocaleContext';

interface AuthMeUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  tenantId: string;
  isPlatformAdmin?: boolean;
}

function hasPlatformAdminPrivilege(user?: AuthMeUser | null): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  if (user.role === 'SuperAdmin' || user.role === 'SystemAdmin') return true;
  return user.role === 'Admin' && user.tenantId === '00000000-0000-0000-0000-000000000001';
}

function App() {
  const { locale, toggleLocale, t } = useAdminLocale();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sa_token'));
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!token || verifiedToken === token) return;

    let active = true;
    saApiClient
      .get('/auth/me')
      .then((res) => {
        if (!active) return;
        const user = res.data?.data as AuthMeUser | undefined;
        if (hasPlatformAdminPrivilege(user)) {
          setVerifiedToken(token);
        } else {
          localStorage.removeItem('sa_token');
          setVerifiedToken(null);
          setToken(null);
          setError(t.login.onlyPlatformAdmin);
        }
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('sa_token');
        setVerifiedToken(null);
        setToken(null);
      });

    return () => {
      active = false;
    };
  }, [token, verifiedToken, t.login.onlyPlatformAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await saApiClient.post('/auth/login', { username, password });
      const data = res.data?.data ?? res.data;
      const accessToken = data?.token || data?.accessToken;
      const user = data?.user as AuthMeUser | undefined;
      if (accessToken && hasPlatformAdminPrivilege(user)) {
        localStorage.setItem('sa_token', accessToken);
        setVerifiedToken(accessToken);
        setToken(accessToken);
      } else if (accessToken) {
        setError(t.login.onlyPlatformAdmin);
      } else {
        setError(t.login.invalidResponse);
      }
    } catch {
      setError(t.login.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saApiClient.post('/auth/demo-login');
      const data = res.data?.data ?? res.data;
      const accessToken = data?.token || data?.accessToken;
      const user = data?.user as AuthMeUser | undefined;
      if (accessToken && hasPlatformAdminPrivilege(user)) {
        localStorage.setItem('sa_token', accessToken);
        setVerifiedToken(accessToken);
        setToken(accessToken);
      } else {
        setError(t.login.onlyPlatformAdmin);
      }
    } catch {
      setError(t.login.demoFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    setVerifiedToken(null);
    setToken(null);
  };

  if (token && verifiedToken !== token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white text-sm">
        {t.dashboard.loading}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-600 text-white">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Senic Super Admin Portal</h1>
                <p className="text-sm text-slate-500">{t.login.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleLocale}
              data-testid="admin-locale-toggle"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200"
            >
              <Globe size={14} /> {locale === 'th' ? 'EN' : 'TH'}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium border border-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.login.usernameLabel}</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.login.passwordLabel}</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              {loading ? t.login.signingIn : t.login.signInBtn}
            </button>
          </form>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            {t.login.demoSignInBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col md:flex-row h-[100dvh] bg-[var(--color-bg)] overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1e293b] text-white shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t.nav.openMenuAria}
              aria-expanded={mobileMenuOpen}
              className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-lg hover:bg-slate-800"
            >
              <Menu size={22} />
            </button>
            <span className="font-bold text-base bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Senic Platform Admin
            </span>
          </div>
        </header>
        <Sidebar onLogout={handleLogout} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {!isOnline && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
              >
                <WifiOff size={18} className="shrink-0" />
                <span>{t.nav.offlineBanner}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 mb-4">
              <button
                type="button"
                onClick={toggleLocale}
                data-testid="admin-locale-toggle"
                title={t.nav.switchLocaleLabel}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors font-medium"
              >
                <Globe size={15} /> {locale === 'th' ? 'EN' : 'TH'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-rose-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
              >
                <LogOut size={16} /> {t.nav.logout}
              </button>
            </div>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<TenantsList />} />
              <Route path="/packages" element={<PackagesList />} />
              <Route path="/invoices" element={<BillingInvoices />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
