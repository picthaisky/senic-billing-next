import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import { User, Lock, Mail, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const { setAuth, token } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // General Form overrides (falls back cleanly to store user values without setState in effect)
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);

  const defaultDisplayName = user
    ? (user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || '')
    : '';
  const defaultEmail = user ? (user.email || user.username || '') : '';
  const displayName = displayNameDraft ?? defaultDisplayName;
  const email = emailDraft ?? defaultEmail;

  // Security Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg('');
    } else {
      setSuccessMsg(msg);
      setErrorMsg('');
    }
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 5000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient.put('/user/profile', { displayName, email });
      if (res.data.success) {
        showMessage(t('profile.updateSuccess'));
        if (user && token) {
          // Update local auth store user (simplified for UI)
          const updatedUser = {
            ...user,
            displayName,
            firstName: displayName.split(' ')[0] || '',
            lastName: displayName.split(' ').slice(1).join(' '),
            email,
          };
          setAuth(token, updatedUser);
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showMessage((err.response?.data as { message?: string } | undefined)?.message || t('profile.updateError'), true);
      } else {
        showMessage(t('profile.updateError'), true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage(t('profile.passwordMismatch'), true);
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.put('/user/change-password', { currentPassword, newPassword });
      if (res.data.success) {
        showMessage(t('profile.passwordSuccess'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showMessage((err.response?.data as { message?: string } | undefined)?.message || t('profile.passwordError'), true);
      } else {
        showMessage(t('profile.passwordError'), true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page-shell profile-page-stack">
      
      {/* Header Section */}
      <div className="card profile-hero-card flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 profile-hero-bg opacity-5 pointer-events-none">
          <Shield size={160} />
        </div>
        <div className="profile-avatar text-white shadow-lg relative z-10 bg-brand-gradient">
          {user ? (user.firstName?.charAt(0) || user.displayName?.charAt(0) || user.username?.charAt(0) || 'U').toUpperCase() : 'U'}
        </div>
        <div className="text-center md:text-left relative z-10">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">
            {user ? (user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'User Profile') : 'User Profile'}
          </h2>
          <p className="profile-hero-subtitle text-[var(--color-text-secondary)]">
            Admin • Senic Corp
          </p>
          <div className="profile-verified-badge inline-flex items-center gap-2 rounded-full text-xs font-medium bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <CheckCircle2 size={14} /> {t('profile.verifiedBadge')}
          </div>
        </div>
      </div>

      {/* Message Alerts */}
      {successMsg && (
        <div className="profile-alert rounded-xl border flex items-center gap-3 animate-fade-in bg-[var(--color-success-bg)] border-[var(--color-success)] text-[var(--color-success)]">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="profile-alert rounded-xl border flex items-center gap-3 animate-fade-in bg-[var(--color-danger-bg)] border-[var(--color-danger)] text-[var(--color-danger)]">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Content Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Sidebar Nav */}
        <div className="md:col-span-1 profile-nav">
          <button
            onClick={() => setActiveTab('general')}
            className={`profile-nav-button rounded-xl text-sm font-semibold transition-all hover:opacity-85 ${
              activeTab === 'general'
                ? 'text-[var(--color-primary)] border border-[var(--color-border)] bg-[var(--color-surface-solid)] shadow-sm'
                : 'text-[var(--color-text-secondary)] border border-transparent bg-transparent'
            }`}
          >
            <User size={18} /> {t('profile.tabGeneral')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`profile-nav-button rounded-xl text-sm font-semibold transition-all hover:opacity-85 ${
              activeTab === 'security'
                ? 'text-[var(--color-primary)] border border-[var(--color-border)] bg-[var(--color-surface-solid)] shadow-sm'
                : 'text-[var(--color-text-secondary)] border border-transparent bg-transparent'
            }`}
          >
            <Lock size={18} /> {t('profile.tabSecurity')}
          </button>
        </div>

        {/* Form Area */}
        <div className="md:col-span-3">
          
          {activeTab === 'general' && (
            <div className="card form-section-card animate-fade-in">
              <h3 className="profile-section-title text-lg font-bold text-[var(--color-text)]">{t('profile.generalTitle')}</h3>
              <form onSubmit={handleUpdateProfile} className="form-stack-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="profile-username" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.usernameLabel')}
                  </label>
                  <input
                    id="profile-username"
                    type="text"
                    className="input-field bg-[var(--color-bg-secondary)] cursor-not-allowed"
                    value={user?.email || ''}
                    disabled
                    title={t('profile.usernameLabel')}
                  />
                  <p className="profile-helper-text text-xs text-[var(--color-text-muted)]">{t('profile.usernameHint')}</p>
                </div>
                <div>
                  <label htmlFor="profile-displayname" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.displayNameLabel')}
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input 
                      id="profile-displayname"
                      type="text" 
                      className="input-field profile-input-with-icon" 
                      value={displayName}
                      onChange={e => setDisplayNameDraft(e.target.value)}
                      required
                      title={t('profile.displayNameLabel')}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="profile-email" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.emailLabel')}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input 
                      id="profile-email"
                      type="email" 
                      className="input-field profile-input-with-icon" 
                      value={email}
                      onChange={e => setEmailDraft(e.target.value)}
                      title={t('profile.emailLabel')}
                    />
                  </div>
                </div>
                </div>

                <div className="profile-form-actions">
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? t('profile.saving') : t('profile.saveProfile')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card form-section-card animate-fade-in">
              <h3 className="profile-section-title text-lg font-bold text-[var(--color-text)]">{t('profile.securityTitle')}</h3>
              <form onSubmit={handleChangePassword} className="form-stack-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="profile-current-password" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.currentPassword')}
                  </label>
                  <input
                    id="profile-current-password"
                    type="password"
                    className="input-field"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    title={t('profile.currentPassword')}
                  />
                </div>
                <div>
                  <label htmlFor="profile-new-password" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.newPassword')}
                  </label>
                  <input 
                    id="profile-new-password"
                    type="password" 
                    className="input-field" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    title={t('profile.newPassword')}
                  />
                </div>
                <div>
                  <label htmlFor="profile-confirm-password" className="block text-sm font-medium layout-form-label-tight text-[var(--color-text-secondary)]">
                    {t('profile.confirmPassword')}
                  </label>
                  <input 
                    id="profile-confirm-password"
                    type="password" 
                    className="input-field" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    title={t('profile.confirmPassword')}
                  />
                </div>
                </div>

                <div className="profile-form-actions">
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? t('profile.saving') : t('profile.updatePassword')}
                  </button>
                </div>
              </form>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
