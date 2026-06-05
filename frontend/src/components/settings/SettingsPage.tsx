import { useState } from 'react';
import { Building2, Mail, Phone, MapPin, Save, Bell, BellOff, Send, Languages } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import { useLocaleStore } from '../../store/useLocaleStore';
import RecurringInvoicesConfig from './RecurringInvoicesConfig';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const language = useLocaleStore((state) => state.language);
  const setLanguage = useLocaleStore((state) => state.setLanguage);
  const user = useAuthStore(state => state.user);
  const [isSaving, setIsSaving] = useState(false);
  const pushNotifications = usePushNotifications();
  
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

  const handleChangeLanguage = (nextLanguage: 'th' | 'en') => {
    setLanguage(nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">ตั้งค่าระบบ</h2>
          <p className="settings-page-subtitle text-sm text-[var(--color-text-muted)]">จัดการข้อมูลองค์กรและการแจ้งเตือน</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="card form-section-card lg:col-span-2">
        <h3 className="settings-section-title-lg font-bold text-lg flex items-center gap-2">
          <Building2 size={20} className="text-[var(--color-primary)]" />
          ข้อมูลองค์กร (Tenant Settings)
        </h3>
        
        <form onSubmit={handleSave} className="form-stack-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="layout-form-label-sm block text-sm font-medium">ชื่อบริษัทจดทะเบียน *</label>
              <input required type="text" className="input-field" value={tenantInfo.companyName} title="ชื่อบริษัทจดทะเบียน" placeholder="กรอกชื่อบริษัทจดทะเบียน"
                onChange={e => setTenantInfo({...tenantInfo, companyName: e.target.value})} />
            </div>
            
            <div className="md:col-span-2">
              <label className="layout-form-label-sm block text-sm font-medium">เลขประจำตัวผู้เสียภาษี *</label>
              <input required type="text" className="input-field" value={tenantInfo.taxId} title="เลขประจำตัวผู้เสียภาษี" placeholder="กรอกเลขประจำตัวผู้เสียภาษี"
                onChange={e => setTenantInfo({...tenantInfo, taxId: e.target.value})} />
            </div>
            
            <div>
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Mail size={14} className="text-[var(--color-text-muted)]" /> อีเมลติดต่อ
              </label>
              <input type="email" className="input-field" value={tenantInfo.email} title="อีเมลติดต่อ" placeholder="example@company.com"
                onChange={e => setTenantInfo({...tenantInfo, email: e.target.value})} />
            </div>
            
            <div>
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Phone size={14} className="text-[var(--color-text-muted)]" /> เบอร์โทรศัพท์
              </label>
              <input type="text" className="input-field" value={tenantInfo.phone} title="เบอร์โทรศัพท์" placeholder="02-123-4567"
                onChange={e => setTenantInfo({...tenantInfo, phone: e.target.value})} />
            </div>
            
            <div className="md:col-span-2">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <MapPin size={14} className="text-[var(--color-text-muted)]" /> ที่อยู่จดทะเบียน *
              </label>
              <textarea required className="input-field h-24 resize-none" value={tenantInfo.address} title="ที่อยู่จดทะเบียน" placeholder="กรอกที่อยู่จดทะเบียน"
                onChange={e => setTenantInfo({...tenantInfo, address: e.target.value})} />
            </div>
          </div>
          
          <div className="form-modal-actions">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="card form-section-card">
        <h3 className="settings-section-title-md font-bold text-lg">บัญชีผู้ใช้</h3>
        <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
          ข้อมูลผู้ใช้งานระบบที่กำลังล็อกอินอยู่
        </p>
        <div className="flex items-center gap-4 p-4 rounded-xl border bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-brand-gradient">
            {user?.firstName?.[0] || 'A'}
          </div>
          <div>
            <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <span className="badge badge-success">Active</span>
          </div>
        </div>
      </div>
      </div>
      {/* ── End top row grid ── */}

      <div className="card form-section-card">
        <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
          <Languages size={20} className="text-[var(--color-primary)]" />
          {t('settings.languageTitle')}
        </h3>
        <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
          {t('settings.languageDescription')}
        </p>

        <div className="p-4 border rounded-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
          <div className="text-sm text-[var(--color-text-secondary)]">
            {t('common.language')}: <span className="font-semibold text-[var(--color-text)]">{language === 'th' ? t('common.thai') : t('common.english')}</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleChangeLanguage('th')}
              className={`btn ${language === 'th' ? 'btn-primary' : 'btn-secondary'} flex-1 sm:flex-none`}
            >
              {t('common.thai')}
            </button>
            <button
              type="button"
              onClick={() => handleChangeLanguage('en')}
              className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'} flex-1 sm:flex-none`}
            >
              {t('common.english')}
            </button>
          </div>
        </div>
      </div>

      <div className="card form-section-card">
        <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
          <Bell size={20} className="text-[var(--color-primary)]" />
          การแจ้งเตือน (Push Notifications)
        </h3>
        <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
          รับการแจ้งเตือนเมื่อมีเอกสารใหม่ หรือการอัปเดตสถานะที่สำคัญ ผ่านเบราว์เซอร์และมือถือ
        </p>

        <div className="p-4 border rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
          <div>
            <div className="settings-status-row font-semibold flex items-center gap-2">
              สถานะ: 
              {pushNotifications.isSubscribed ? (
                <span className="badge badge-success flex items-center gap-1"><Bell size={12} /> เปิดใช้งานแล้ว</span>
              ) : (
                <span className="badge badge-neutral flex items-center gap-1"><BellOff size={12} /> ปิดอยู่</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {pushNotifications.isSupported 
                ? 'เบราว์เซอร์นี้รองรับการแจ้งเตือนแบบ Offline' 
                : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'}
            </p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            {pushNotifications.isSubscribed ? (
              <>
                <button 
                  onClick={() => pushNotifications.sendTestNotification()} 
                  className="btn btn-secondary flex-1 md:flex-none"
                >
                  <Send size={16} /> ทดสอบแจ้งเตือน
                </button>
                <button
                  onClick={() => pushNotifications.unsubscribe()}
                  className="btn flex-1 md:flex-none text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                >
                  <BellOff size={16} /> ปิดแจ้งเตือน
                </button>
              </>
            ) : (
              <button 
                onClick={() => pushNotifications.subscribe()} 
                disabled={!pushNotifications.isSupported}
                className="btn btn-primary flex-1 md:flex-none"
              >
                <Bell size={16} /> เปิดการแจ้งเตือน
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recurring Invoices */}
      <RecurringInvoicesConfig />
    </div>
  );
}
