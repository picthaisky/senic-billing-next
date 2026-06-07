import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, Trash2, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../store/useAuthStore';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: string;
}

export default function StaffManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore(state => state.user);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', email: '', role: 'User' });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tenant-users');
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/tenant-users', newUser);
      setShowInviteModal(false);
      setNewUser({ username: '', password: '', displayName: '', email: '', role: 'User' });
      fetchUsers();
      alert('เชิญผู้ใช้สำเร็จ');
    } catch (error) {
      console.error('Failed to invite user:', error);
      alert('เกิดข้อผิดพลาดในการเชิญผู้ใช้ (ชื่อผู้ใช้อาจซ้ำ)');
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    if (id === currentUser?.id) {
      alert('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้');
      return;
    }
    try {
      await apiClient.put(`/tenant-users/${id}/role`, { role: newRole });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      alert('ไม่สามารถลบบัญชีตัวเองได้');
      return;
    }
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานนี้?')) return;
    
    try {
      await apiClient.delete(`/tenant-users/${id}`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('เกิดข้อผิดพลาดในการลบผู้ใช้งาน');
    }
  };

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">จัดการพนักงาน</h2>
            <p className="text-sm text-[var(--color-text-muted)]">จัดการสิทธิ์การเข้าถึงระบบของพนักงานในองค์กร</p>
          </div>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
          <UserPlus size={16} /> เชิญพนักงาน
        </button>
      </div>

      <div className="card form-section-card p-6 md:p-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]/50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">พนักงาน</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">ชื่อผู้ใช้ (Username)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">สิทธิ์การใช้งาน (Role)</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8">กำลังโหลด...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-[var(--color-text-muted)]">ไม่พบพนักงานในระบบ</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-brand-gradient">
                          {u.displayName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--color-text)]">{u.displayName}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{u.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">{u.username}</td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === currentUser?.id}
                        className="input-field max-w-[150px] py-1 text-sm"
                      >
                        <option value="Admin">แอดมิน (Admin)</option>
                        <option value="Accountant">บัญชี (Accountant)</option>
                        <option value="Sales">ฝ่ายขาย (Sales)</option>
                        <option value="User">ทั่วไป (User)</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-primary)] w-full max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6 border-b border-[var(--color-border)] pb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">เชิญพนักงาน</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-[var(--color-bg-secondary)] rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อผู้ใช้ (Username) *</label>
                <input required type="text" className="input-field" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">รหัสผ่านชั่วคราว *</label>
                <input required type="password" className="input-field" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อที่แสดง *</label>
                <input required type="text" className="input-field" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">อีเมล</label>
                <input type="email" className="input-field" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">สิทธิ์การใช้งาน (Role)</label>
                <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="User">ทั่วไป (User)</option>
                  <option value="Sales">ฝ่ายขาย (Sales)</option>
                  <option value="Accountant">บัญชี (Accountant)</option>
                  <option value="Admin">แอดมิน (Admin)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-full mt-6">
                เพิ่มพนักงาน
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
