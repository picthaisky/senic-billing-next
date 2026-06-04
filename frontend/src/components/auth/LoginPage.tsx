import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const { token, user } = response.data;
      setAuth(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="card w-full max-w-[400px] animate-fade-in-up"
        style={{ padding: '36px 32px' }}
      >
        {/* Brand */}
        <div className="text-center" style={{ marginBottom: 28 }}>
          <div
            className="flex items-center justify-center text-white font-bold mx-auto"
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              fontSize: 30,
              marginBottom: 16,
              background: 'var(--gradient-brand)',
            }}
          >
            S
          </div>
          <h1 className="font-bold" style={{ margin: 0, fontSize: 24, color: 'var(--color-text)' }}>
            Senic<span style={{ color: 'var(--color-primary)' }}>Billing</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
            เข้าสู่ระบบเพื่อจัดการเอกสารของคุณ
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label
              className="block font-medium"
              style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}
            >
              ชื่อผู้ใช้งาน
            </label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label
              className="block font-medium"
              style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}
            >
              รหัสผ่าน
            </label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full"
            style={{ marginTop: 4 }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
