import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import axios from 'axios';

type AuthMode = 'login' | 'forgot' | 'reset' | 'signup';

export default function LoginPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(() => {
    const tokenParam = new URLSearchParams(window.location.search).get('resetToken');
    return tokenParam ? 'reset' : 'login';
  });
  const [resetToken] = useState(
    () => new URLSearchParams(window.location.search).get('resetToken') || ''
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#impersonate=')) return;
    const rawToken = decodeURIComponent(hash.slice('#impersonate='.length)).trim();
    if (!rawToken) return;

    let active = true;
    apiClient
      .get('/auth/me', { headers: { Authorization: `Bearer ${rawToken}` } })
      .then((res) => {
        if (!active) return;
        const verifiedUser = res.data?.data ?? res.data;
        if (verifiedUser?.id) {
          setAuth(rawToken, verifiedUser);
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        if (active) {
          setError(t('auth.invalidImpersonation'));
        }
      });

    return () => {
      active = false;
    };
  }, [navigate, setAuth, t]);

  const switchMode = (next: AuthMode) => {
    setError('');
    setNotice('');
    setMode(next);
  };

  const extractAxiosError = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      return err.response?.data?.message || err.message || fallback;
    }
    return fallback;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const payload = response.data?.data ?? response.data;
      const { token, user } = payload ?? {};

      if (!token || !user) {
        throw new Error(t('auth.invalidPayload'));
      }

      setAuth(token, user);
      navigate('/');
    } catch (err: unknown) {
      setError(extractAxiosError(err, t('auth.invalidCredentials')));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { emailOrUsername: identifier });
      setNotice(t('auth.resetSentSuccess'));
    } catch (err: unknown) {
      setError(extractAxiosError(err, t('auth.invalidCredentials')));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        token: resetToken,
        newPassword,
      });
      setMode('login');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setNotice(t('auth.resetPasswordSuccess'));
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setError(extractAxiosError(err, t('auth.invalidCredentials')));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/signup-tenant', {
        companyName,
        taxId: taxId || undefined,
        email: email || undefined,
        displayName: displayName || undefined,
        username,
        password,
      });

      const payload = response.data?.data ?? response.data;
      const { token, user } = payload ?? {};
      if (!token || !user) {
        throw new Error(t('auth.invalidPayload'));
      }

      setAuth(token, user);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(extractAxiosError(err, t('auth.invalidPayload')));
    } finally {
      setLoading(false);
    }
  };

  const subtitleText =
    mode === 'forgot'
      ? t('auth.forgotSubtitle')
      : mode === 'reset'
        ? t('auth.resetSubtitle')
        : mode === 'signup'
          ? t('auth.signupSubtitle')
          : t('auth.subtitle');

  const submitHandler =
    mode === 'forgot'
      ? handleForgotSubmit
      : mode === 'reset'
        ? handleResetSubmit
        : mode === 'signup'
          ? handleSignupSubmit
          : handleLogin;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="card layout-auth-card w-full max-w-[440px] animate-fade-in-up">
        {/* Brand */}
        <div className="layout-auth-brand text-center">
          <div className="layout-auth-logo flex items-center justify-center text-white font-bold bg-brand-gradient">
            S
          </div>
          <h1 className="font-bold m-0 text-2xl text-[var(--color-text)]">
            Senic<span className="text-[var(--color-primary)]">Billing</span>
          </h1>
          <p className="layout-auth-subtitle text-sm text-[var(--color-text-muted)]">
            {subtitleText}
          </p>
        </div>

        <form onSubmit={submitHandler} className="flex flex-col gap-[16px]">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {notice && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
              {notice}
            </div>
          )}

          {mode === 'login' && (
            <>
              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.username')}
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
                <div className="flex items-center justify-between">
                  <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {t('auth.forgotPasswordLink')}
                  </button>
                </div>
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
                {loading ? t('auth.submitting') : t('auth.submit')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {t('auth.signupLink')}
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.identifierLabel')}
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="admin@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full layout-auth-submit-btn"
              >
                {loading ? t('auth.submitting') : t('auth.sendResetBtn')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.newPasswordLabel')}
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.confirmNewPasswordLabel')}
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full layout-auth-submit-btn"
              >
                {loading ? t('auth.submitting') : t('auth.saveNewPasswordBtn')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.companyNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.taxIdOptionalLabel')}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    maxLength={13}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.emailOptionalLabel')}
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                  {t('auth.displayNameLabel')}
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.username')}
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="layout-form-label-tight block font-medium text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.password')}
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full layout-auth-submit-btn"
              >
                {loading ? t('auth.submitting') : t('auth.createOrgBtn')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
