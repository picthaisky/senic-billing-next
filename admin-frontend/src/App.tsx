import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import TenantsList from './pages/TenantsList';
import PackagesList from './pages/PackagesList';
import Sidebar from './components/Sidebar';
import { saApiClient } from './services/apiClient';

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('sa_token') || localStorage.getItem('senic_token')
  );
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await saApiClient.post('/auth/login', { username, password });
      const accessToken = res.data?.data?.accessToken || res.data?.accessToken;
      if (accessToken) {
        localStorage.setItem('sa_token', accessToken);
        setToken(accessToken);
      } else {
        setError('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
      }
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saApiClient.post('/auth/demo-login');
      const accessToken = res.data?.data?.accessToken || res.data?.accessToken;
      if (accessToken) {
        localStorage.setItem('sa_token', accessToken);
        setToken(accessToken);
      }
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบ Demo ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    setToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-600 text-white">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Senic Super Admin Portal</h1>
              <p className="text-sm text-slate-500">เข้าสู่ระบบจัดการแพลตฟอร์ม SaaS Multi-Tenant</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium border border-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อผู้ใช้ (Admin)</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
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
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            เข้าสู่ระบบด่วน (Demo Super Admin)
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-[var(--color-bg)]">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-end mb-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-rose-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
              >
                <LogOut size={16} /> ออกจากระบบ
              </button>
            </div>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<TenantsList />} />
              <Route path="/packages" element={<PackagesList />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
