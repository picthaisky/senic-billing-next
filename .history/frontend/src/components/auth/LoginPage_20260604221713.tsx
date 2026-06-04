import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import axios from 'axios';

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

      const payload = response.data?.data ?? response.data;
      const { token, user } = payload ?? {};

      if (!token || !user) {
        throw new Error('รูปแบบข้อมูลการเข้าสู่ระบบไม่ถูกต้อง');
      }

      setAuth(token, user);
      navigate('/');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || err.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        setError('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]"
    >
      <div
        className="card layout-auth-card w-full max-w-[400px] animate-fade-in-up"
      >
        {/* Brand */}
        <div className="layout-auth-brand text-center">
          <div
            className="layout-auth-logo flex items-center justify-center text-white font-bold mx-auto w-14 h-14 rounded-[18px] text-[30px] bg-brand-gradient"
          >
            S
          </div>
          <h1 className="font-bold m-0 text-2xl text-[var(--color-text)]">
            Senic<span className="text-[var(--color-primary)]">Billing</span>
          </h1>
          <p className="layout-auth-subtitle text-sm text-[var(--color-text-muted)]">
            เข้าสู่ระบบเพื่อจัดการเอกสารของคุณ
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label
              className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]"
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
              className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]"
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
            className="btn btn-primary btn-lg w-full layout-auth-submit-btn"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
