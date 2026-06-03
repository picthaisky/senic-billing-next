import { useState } from 'react';
import { Building2, Mail, Phone, MapPin, Save } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const [isSaving, setIsSaving] = useState(false);
  
  const [tenantInfo, setTenantInfo] = useState({
    companyName: 'Senic Corporation',
    taxId: '0105560000000',
    email: 'contact@senic.co.th',
    phone: '02-999-9999',
    address: '99/9 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ 10310'
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      // await apiClient.put(`/tenants/${user?.tenantId}`, tenantInfo);
      setTimeout(() => {
        setIsSaving(false);
        alert('บันทึกการตั้งค่าสำเร็จ');
      }, 500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Building2 size={20} style={{ color: 'var(--color-primary)' }} />
          ข้อมูลองค์กร (Tenant Settings)
        </h3>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">ชื่อบริษัทจดทะเบียน *</label>
              <input required type="text" className="input-field" value={tenantInfo.companyName} 
                onChange={e => setTenantInfo({...tenantInfo, companyName: e.target.value})} />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">เลขประจำตัวผู้เสียภาษี *</label>
              <input required type="text" className="input-field" value={tenantInfo.taxId} 
                onChange={e => setTenantInfo({...tenantInfo, taxId: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Mail size={14} className="text-gray-400" /> อีเมลติดต่อ
              </label>
              <input type="email" className="input-field" value={tenantInfo.email} 
                onChange={e => setTenantInfo({...tenantInfo, email: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Phone size={14} className="text-gray-400" /> เบอร์โทรศัพท์
              </label>
              <input type="text" className="input-field" value={tenantInfo.phone} 
                onChange={e => setTenantInfo({...tenantInfo, phone: e.target.value})} />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <MapPin size={14} className="text-gray-400" /> ที่อยู่จดทะเบียน *
              </label>
              <textarea required className="input-field h-24 resize-none" value={tenantInfo.address} 
                onChange={e => setTenantInfo({...tenantInfo, address: e.target.value})} />
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t dark:border-zinc-800 mt-6">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-2">บัญชีผู้ใช้</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ข้อมูลผู้ใช้งานระบบที่กำลังล็อกอินอยู่
        </p>
        <div className="flex items-center gap-4 p-4 rounded-xl border dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" 
               style={{ background: 'var(--gradient-brand)' }}>
            {user?.firstName?.[0] || 'A'}
          </div>
          <div>
            <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user?.email}</p>
          </div>
          <div className="ml-auto">
            <span className="badge badge-success">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
