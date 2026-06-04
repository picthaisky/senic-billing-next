import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../services/apiClient';
import { User, Lock, Mail, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const user = useAuthStore(state => state.user);
  const { setAuth, token } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // General Form
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  // Security Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(`${user.firstName} ${user.lastName}`);
      setEmail(user.email || '');
    }
  }, [user]);

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
        showMessage('อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว');
        // Update local auth store user (simplified for UI)
        const updatedUser = { ...user, firstName: displayName.split(' ')[0], lastName: displayName.split(' ')[1] || '', email } as any;
        if (token) setAuth(token, updatedUser);
      }
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล', true);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน', true);
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.put('/user/change-password', { currentPassword, newPassword });
      if (res.data.success) {
        showMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="card p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Shield size={160} />
        </div>
        <div 
          className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl text-white font-bold shadow-lg relative z-10"
          style={{ background: 'var(--gradient-brand)' }}
        >
          {user ? user.firstName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="text-center md:text-left relative z-10">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {user ? `${user.firstName} ${user.lastName}` : 'User Profile'}
          </h2>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Admin • Senic Corp
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 size={14} /> บัญชีได้รับการยืนยันแล้ว
          </div>
        </div>
      </div>

      {/* Message Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 animate-fade-in">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Content Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('general')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-85"
            style={{ 
              color: activeTab === 'general' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: activeTab === 'general' ? '1px solid var(--color-border)' : '1px solid transparent',
              backgroundColor: activeTab === 'general' ? 'var(--color-surface-solid)' : 'transparent',
              boxShadow: activeTab === 'general' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <User size={18} /> ข้อมูลทั่วไป
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-85"
            style={{ 
              color: activeTab === 'security' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: activeTab === 'security' ? '1px solid var(--color-border)' : '1px solid transparent',
              backgroundColor: activeTab === 'security' ? 'var(--color-surface-solid)' : 'transparent',
              boxShadow: activeTab === 'security' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Lock size={18} /> ความปลอดภัย
          </button>
        </div>

        {/* Form Area */}
        <div className="md:col-span-3">
          
          {activeTab === 'general' && (
            <div className="card p-6 animate-fade-in">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text)' }}>ข้อมูลทั่วไป (General Information)</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    ชื่อผู้ใช้งาน (Email)
                  </label>
                  <input 
                    type="text" 
                    className="input-field bg-gray-50 cursor-not-allowed" 
                    value={user?.email || ''}
                    disabled
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>* ไม่สามารถเปลี่ยนชื่อผู้ใช้งานระบบได้</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    ชื่อที่แสดง (Display Name)
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                    <input 
                      type="text" 
                      className="input-field pl-9" 
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                    <input 
                      type="email" 
                      className="input-field pl-9" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card p-6 animate-fade-in">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text)' }}>เปลี่ยนรหัสผ่าน (Change Password)</h3>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    รหัสผ่านปัจจุบัน (Current Password)
                  </label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    รหัสผ่านใหม่ (New Password)
                  </label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    ยืนยันรหัสผ่านใหม่ (Confirm New Password)
                  </label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'กำลังบันทึก...' : 'อัปเดตรหัสผ่าน'}
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
