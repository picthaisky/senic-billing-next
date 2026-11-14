import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Eye, EyeOff, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/errorUtils';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isActive?: boolean;
}

interface UserFormModalProps {
  user: User | null;
  roles: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ user, roles, onClose, onSaved }: UserFormModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    role: 'User',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!user;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (user) {
        setFormData({
          username: user.username,
          displayName: user.displayName || '',
          email: user.email || '',
          role: user.role || 'User',
          password: '', // Blank when editing unless they want to change
        });
      } else if (roles.length > 0 && !roles.includes('User')) {
        setFormData(prev => ({ ...prev, role: roles[0] }));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, roles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      if (isEditing) {
        // Update
        await apiClient.put(`/admin/users/${user.id}`, {
          displayName: formData.displayName,
          email: formData.email,
          role: formData.role,
          password: formData.password || undefined,
        });
      } else {
        // Create
        if (!formData.username || !formData.password) {
          alert(t('usersPage.requiredUsernamePassword'));
          setIsSaving(false);
          return;
        }
        await apiClient.post('/admin/users', formData);
      }
      onSaved();
    } catch (error: unknown) {
      console.error('Failed to save user', error);
      alert(getApiErrorMessage(error, t('usersPage.saveUserError')));
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface-solid)] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text)]">
            <Shield size={20} className="text-[var(--color-primary)]" />
            {isEditing ? t('usersPage.modalEditTitle') : t('usersPage.modalAddTitle')}
          </h2>
          <button onClick={onClose} className="p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('usersPage.usernameLabel')} <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isEditing}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all disabled:opacity-50 text-[var(--color-text)]"
              placeholder="e.g. jdoe"
              required={!isEditing}
            />
            {isEditing && <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('usersPage.usernameCannotChange')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('usersPage.displayNameLabel')}</label>
            <input
              type="text"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all text-[var(--color-text)]"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('usersPage.emailLabel')}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all text-[var(--color-text)]"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('usersPage.roleLabel')} <span className="text-red-500">*</span></label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all text-[var(--color-text)]"
            >
              {roles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              {!roles.includes('User') && <option value="User">User</option>}
              {!roles.includes('Admin') && <option value="Admin">Admin</option>}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              {isEditing ? t('usersPage.passwordChangeLabel') : t('usersPage.passwordLabel')} {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 pr-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all text-[var(--color-text)]"
                placeholder={isEditing ? t('usersPage.passwordPlaceholderEdit') : t('usersPage.passwordPlaceholderNew')}
                required={!isEditing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors font-medium"
              disabled={isSaving}
            >
              {t('usersPage.cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-all font-medium flex items-center gap-2 disabled:opacity-50"
              disabled={isSaving}
            >
              <Save size={18} />
              {isSaving ? t('usersPage.saving') : t('usersPage.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
