import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, UserPlus, Key, Edit, UserCheck, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';
import UserFormModal from './UserFormModal';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RoleWithPermissions {
  roleName: string;
  permissionIds: string[];
}

export default function UsersManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await apiClient.get('/admin/users');
      setUsers(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchRolesAndPermissions = useCallback(async () => {
    try {
      setLoadingRoles(true);
      const [permRes, roleRes] = await Promise.all([
        apiClient.get('/admin/roles/permissions'),
        apiClient.get('/admin/roles')
      ]);
      setPermissions(permRes.data?.data || []);
      
      const rolesData = (roleRes.data?.data || []) as RoleWithPermissions[];
      setRoles(rolesData);
      if (rolesData.length > 0) {
        setSelectedRole((prev) => prev ?? rolesData[0]);
      }
    } catch (error) {
      console.error('Failed to fetch roles and permissions', error);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === 'users') {
        void fetchUsers();
        if (roles.length === 0) {
          void fetchRolesAndPermissions();
        }
      } else {
        void fetchRolesAndPermissions();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, fetchUsers, fetchRolesAndPermissions, roles.length]);

  const handleToggleUserStatus = async (user: User) => {
    const nextActive = !user.isActive;
    const actionLabel = nextActive ? t('usersPage.activateAction') : t('usersPage.suspendAction');
    if (!window.confirm(t('usersPage.confirmToggle', { action: actionLabel, username: user.username }))) return;
    try {
      await apiClient.put(`/admin/users/${user.id}/status`, { isActive: nextActive });
      void fetchUsers();
    } catch (error: unknown) {
      const msg =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('usersPage.toggleError', { action: actionLabel }));
    }
  };

  const handleQuickRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiClient.put(`/tenant-users/${userId}/role`, { role: newRole });
      void fetchUsers();
    } catch {
      alert(t('usersPage.roleChangeError'));
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      await apiClient.post('/admin/roles', {
        roleName: selectedRole.roleName,
        permissionIds: selectedRole.permissionIds
      });
      alert(t('usersPage.saveRoleSuccess'));
      fetchRolesAndPermissions();
    } catch (error) {
      console.error('Failed to save role permissions', error);
      alert(t('usersPage.saveError'));
    }
  };

  const togglePermission = (permissionId: string) => {
    if (!selectedRole) return;
    const hasPerm = selectedRole.permissionIds.includes(permissionId);
    let newPerms;
    if (hasPerm) {
      newPerms = selectedRole.permissionIds.filter(id => id !== permissionId);
    } else {
      newPerms = [...selectedRole.permissionIds, permissionId];
    }
    setSelectedRole({ ...selectedRole, permissionIds: newPerms });
  };

  const categories = Array.from(new Set(permissions.map(p => p.category)));

  return (
    <div className="p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 rounded-full bg-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('usersPage.pageTitle')}</h1>
      </div>

      <div className="flex space-x-1 bg-[var(--color-surface-hover)] p-1 rounded-xl w-fit">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users' ? 'bg-[var(--color-surface-solid)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} /> {t('usersPage.tabUsers')}
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'roles' ? 'bg-[var(--color-surface-solid)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => setActiveTab('roles')}
        >
          <Shield size={16} /> {t('usersPage.tabRoles')}
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-[var(--color-surface-solid)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-secondary)]">
            <h2 className="font-semibold flex items-center gap-2">
              <Users size={18} className="text-[var(--color-primary)]" />
              {t('usersPage.allUsersTitle')}
            </h2>
            <button
              onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <UserPlus size={16} /> {t('usersPage.addUser')}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)] text-sm">
                  <th className="p-4 font-semibold text-[var(--color-text-muted)]">{t('usersPage.colUsername')}</th>
                  <th className="p-4 font-semibold text-[var(--color-text-muted)]">{t('usersPage.colDisplayName')}</th>
                  <th className="p-4 font-semibold text-[var(--color-text-muted)]">{t('usersPage.colEmail')}</th>
                  <th className="p-4 font-semibold text-[var(--color-text-muted)] text-center">{t('usersPage.colRole')}</th>
                  <th className="p-4 font-semibold text-[var(--color-text-muted)] text-center">{t('usersPage.colStatus')}</th>
                  <th className="p-4 font-semibold text-[var(--color-text-muted)] text-right">{t('usersPage.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[var(--color-text-muted)]">{t('usersPage.loading')}</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[var(--color-text-muted)]">{t('usersPage.emptyUsers')}</td></tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] ${user.isActive === false ? 'opacity-60' : ''}`}>
                      <td className="p-4 font-medium text-[var(--color-text)]">{user.username}</td>
                      <td className="p-4 text-[var(--color-text)]">{user.displayName || '-'}</td>
                      <td className="p-4 text-[var(--color-text)]">{user.email || '-'}</td>
                      <td className="p-4 text-center">
                        <select
                          aria-label={t('usersPage.roleSelectAria', { username: user.username })}
                          value={user.role}
                          onChange={(e) => handleQuickRoleChange(user.id, e.target.value)}
                          className="input-field py-1 px-2.5 text-xs font-medium max-w-[140px] mx-auto"
                        >
                          {Array.from(new Set(['Admin', 'Accountant', 'Sales', 'User', ...roles.map(r => r.roleName), user.role])).map((roleOpt) => (
                            <option key={roleOpt} value={roleOpt}>
                              {roleOpt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`badge text-xs ${user.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                          {user.isActive !== false ? t('usersPage.statusActive') : t('usersPage.statusSuspended')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-md"
                            title={t('usersPage.editTitle')}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => void handleToggleUserStatus(user)}
                            className={`p-1.5 rounded-md ${user.isActive !== false ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            title={user.isActive !== false ? t('usersPage.suspendAction') : t('usersPage.reactivateTitle')}
                          >
                            {user.isActive !== false ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-[var(--color-surface-solid)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden h-fit">
            <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <h2 className="font-semibold text-[var(--color-text)]">{t('usersPage.rolesTitle')}</h2>
            </div>
            <div className="p-2 space-y-1">
              {loadingRoles ? (
                <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">{t('usersPage.loadingShort')}</div>
              ) : (
                roles.map(role => (
                  <button
                    key={role.roleName}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                      selectedRole?.roleName === role.roleName 
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold' 
                        : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                    }`}
                  >
                    {role.roleName}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="md:col-span-3 bg-[var(--color-surface-solid)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex justify-between items-center">
              <h2 className="font-semibold text-[var(--color-text)]">
                {t('usersPage.rolePermFor')} <span className="text-[var(--color-primary)]">{selectedRole?.roleName || '-'}</span>
              </h2>
              <button 
                className="btn btn-primary btn-sm flex items-center gap-2"
                onClick={handleSaveRolePermissions}
                disabled={!selectedRole || selectedRole.roleName === 'SystemAdmin'}
              >
                <Key size={16} /> {t('usersPage.saveChanges')}
              </button>
            </div>
            
            <div className="p-6">
              {!selectedRole ? (
                <div className="text-center py-12 text-[var(--color-text-muted)]">{t('usersPage.selectRoleHint')}</div>
              ) : selectedRole.roleName === 'SystemAdmin' ? (
                <div className="text-center py-12 text-red-500 font-medium">{t('usersPage.sysAdminLocked')}</div>
              ) : (
                <div className="space-y-8">
                  {categories.map(category => {
                    const catPerms = permissions.filter(p => p.category === category);
                    return (
                      <div key={category}>
                        <h3 className="text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-2 mb-4">{category}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {catPerms.map(perm => {
                            const isChecked = selectedRole.permissionIds.includes(perm.id);
                            return (
                              <label key={perm.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                isChecked ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                              }`}>
                                <div className="mt-0.5">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                    checked={isChecked}
                                    onChange={() => togglePermission(perm.id)}
                                  />
                                </div>
                                <div>
                                  <div className={`font-medium ${isChecked ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                                    {perm.description}
                                  </div>
                                  <div className="text-xs text-[var(--color-text-muted)] font-mono mt-1">
                                    {perm.name}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <UserFormModal
          user={editingUser}
          roles={roles.map(r => r.roleName)}
          onClose={() => setIsUserModalOpen(false)}
          onSaved={() => {
            setIsUserModalOpen(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
