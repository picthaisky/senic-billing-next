import { useState, useEffect, useCallback } from 'react';
import { Building2, Mail, Phone, MapPin, Save, Bell, BellOff, Send, Languages, Crown, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import { useLocaleStore } from '../../store/useLocaleStore';
import RecurringInvoicesConfig from './RecurringInvoicesConfig';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/errorUtils';

interface SubscriptionData {
  subscriptionStatus: string;
  subscriptionValidUntil?: string;
  currentPlan?: {
    id: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxUsers: number;
    maxDocumentsPerMonth: number;
    features?: string;
  } | null;
  usage: {
    currentMonthDocuments: number;
    maxDocumentsPerMonth: number;
    currentUsers: number;
    maxUsers: number;
  };
  availablePlans: Array<{
    id: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxUsers: number;
    maxDocumentsPerMonth: number;
    features?: string;
  }>;
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const language = useLocaleStore((state) => state.language);
  const setLanguage = useLocaleStore((state) => state.setLanguage);
  const user = useAuthStore(state => state.user);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgradingPlan, setIsUpgradingPlan] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const pushNotifications = usePushNotifications();
  
  const [tenantId, setTenantId] = useState<string>('');
  const [hasLineAccessToken, setHasLineAccessToken] = useState(false);
  const [hasLineChannelSecret, setHasLineChannelSecret] = useState(false);
  const [tenantInfo, setTenantInfo] = useState({
    companyName: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    branchName: '',
    logoUrl: '',
    lineNotifyToken: '',
    lineChannelAccessToken: '',
    lineChannelSecret: '',
    lineDefaultTargetId: ''
  });

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await apiClient.get('/subscriptions/current');
      if (res.data?.success && res.data?.data) {
        setSubscription(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }, []);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await apiClient.get('/tenants/current');
        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          setTenantId(d.id || '');
          setHasLineAccessToken(Boolean(d.hasLineChannelAccessToken));
          setHasLineChannelSecret(Boolean(d.hasLineChannelSecret));
          setTenantInfo({
            companyName: d.companyName || '',
            taxId: d.taxId || '',
            email: d.email || '',
            phone: d.phone || '',
            address: d.address || '',
            branchName: d.branchName || 'สำนักงานใหญ่',
            logoUrl: d.logoUrl || '',
            lineNotifyToken: d.lineNotifyToken || '',
            lineChannelAccessToken: '',
            lineChannelSecret: '',
            lineDefaultTargetId: d.lineDefaultTargetId || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
      }
    };
    void fetchTenant();
    const timer = window.setTimeout(() => {
      void fetchSubscription();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSubscription]);

  const handleUpgradePlan = async (planId: string, planName: string) => {
    if (!window.confirm(`ยืนยันการเปลี่ยน/อัปเกรดเป็นแพ็กเกจ "${planName}" หรือไม่?`)) return;
    try {
      setIsUpgradingPlan(planId);
      await apiClient.post('/subscriptions/checkout', { planId, cardToken: '' });
      await fetchSubscription();
      alert(`เปลี่ยนเป็นแพ็กเกจ ${planName} สำเร็จ!`);
    } catch {
      alert('ไม่สามารถอัปเกรดแพ็กเกจได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUpgradingPlan(null);
    }
  };

  const handleTestLineNotify = async () => {
    try {
      const res = await apiClient.post('/tenants/test-line-notify');
      alert(res.data?.message || 'ส่งข้อความทดสอบ LINE Notify สำเร็จ');
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถส่ง LINE Notify ได้ กรุณาบันทึก Token ก่อนทดสอบ'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await apiClient.put(`/tenants/profile`, {
        ...tenantInfo,
        lineChannelAccessToken: tenantInfo.lineChannelAccessToken || null,
        lineChannelSecret: tenantInfo.lineChannelSecret || null,
        lineDefaultTargetId: tenantInfo.lineDefaultTargetId || null
      });
      if (res.data?.data) {
        setHasLineAccessToken(Boolean(res.data.data.hasLineChannelAccessToken));
        setHasLineChannelSecret(Boolean(res.data.data.hasLineChannelSecret));
        setTenantInfo(prev => ({ ...prev, lineChannelAccessToken: '', lineChannelSecret: '' }));
      }
      setIsSaving(false);
      alert('บันทึกการตั้งค่าสำเร็จ');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
      <div className="card form-section-card lg:col-span-2 p-6 md:p-8 space-y-6">
        <h3 className="settings-section-title-lg font-bold text-lg flex items-center gap-2 border-b border-[var(--color-border)] pb-4">
          <Building2 size={22} className="text-[var(--color-primary)]" />
          ข้อมูลองค์กร (Tenant Settings)
        </h3>
        
        <form onSubmit={handleSave} className="form-stack-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium">ชื่อบริษัทจดทะเบียน *</label>
              <input required type="text" className="input-field" value={tenantInfo.companyName} title="ชื่อบริษัทจดทะเบียน" placeholder="กรอกชื่อบริษัทจดทะเบียน"
                onChange={e => setTenantInfo({...tenantInfo, companyName: e.target.value})} />
            </div>
            
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium">เลขประจำตัวผู้เสียภาษี *</label>
              <input required type="text" className="input-field" value={tenantInfo.taxId} title="เลขประจำตัวผู้เสียภาษี" placeholder="กรอกเลขประจำตัวผู้เสียภาษี"
                onChange={e => setTenantInfo({...tenantInfo, taxId: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Mail size={14} className="text-[var(--color-text-muted)]" /> อีเมลติดต่อ
              </label>
              <input type="email" className="input-field" value={tenantInfo.email} title="อีเมลติดต่อ" placeholder="example@company.com"
                onChange={e => setTenantInfo({...tenantInfo, email: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Phone size={14} className="text-[var(--color-text-muted)]" /> เบอร์โทรศัพท์
              </label>
              <input type="text" className="input-field" value={tenantInfo.phone} title="เบอร์โทรศัพท์" placeholder="02-123-4567"
                onChange={e => setTenantInfo({...tenantInfo, phone: e.target.value})} />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium">URL โลโก้บริษัท</label>
              <input type="text" className="input-field" value={tenantInfo.logoUrl} title="URL โลโก้" placeholder="https://example.com/logo.png"
                onChange={e => setTenantInfo({...tenantInfo, logoUrl: e.target.value})} />
              <p className="text-xs text-[var(--color-text-muted)]">ใส่ลิงก์รูปภาพโลโก้เพื่อแสดงบนเอกสาร PDF</p>
            </div>
            
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <MapPin size={14} className="text-[var(--color-text-muted)]" /> ที่อยู่จดทะเบียน *
              </label>
              <textarea required className="input-field h-24 resize-none" value={tenantInfo.address} title="ที่อยู่จดทะเบียน" placeholder="กรอกที่อยู่จดทะเบียน"
                onChange={e => setTenantInfo({...tenantInfo, address: e.target.value})} />
            </div>

            <div className="md:col-span-2 space-y-4 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">การเชื่อมต่อ LINE Official Account (Messaging API) &amp; LINE Notify</h4>
                  <p className="text-xs text-[var(--color-text-muted)]">ระบบจะใช้ LINE Messaging API (Push) เป็นหลัก และ fallback ไปยัง LINE Notify หากตั้งค่าไว้</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestLineNotify}
                  className="btn btn-secondary whitespace-nowrap flex items-center gap-1.5 text-xs"
                >
                  <Send size={14} /> ทดสอบส่ง LINE
                </button>
              </div>

              {tenantId && (
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs space-y-1">
                  <div className="font-semibold text-[var(--color-text)]">LINE Webhook URL (สำหรับรับคำสั่ง "สรุปยอด", "ภาษี", ค้นหาเลขที่เอกสาร):</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-[11px] break-all text-[var(--color-primary)]">
                      {`${window.location.origin}/api/webhooks/line/${tenantId}`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/line/${tenantId}`);
                        alert('คัดลอก Webhook URL แล้ว');
                      }}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      คัดลอก
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">
                    LINE Channel Access Token {hasLineAccessToken && <span className="text-emerald-600">(ตั้งค่าแล้ว)</span>}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={tenantInfo.lineChannelAccessToken}
                    placeholder={hasLineAccessToken ? '•••••••• (กรอกใหม่เมื่อต้องการเปลี่ยน)' : 'Channel Access Token (Long-lived)'}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineChannelAccessToken: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">
                    LINE Channel Secret {hasLineChannelSecret && <span className="text-emerald-600">(ตั้งค่าแล้ว)</span>}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={tenantInfo.lineChannelSecret}
                    placeholder={hasLineChannelSecret ? '•••••••• (กรอกใหม่เมื่อต้องการเปลี่ยน)' : 'Channel Secret สำหรับยืนยัน Webhook'}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineChannelSecret: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">LINE Target ID (userId / groupId)</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={tenantInfo.lineDefaultTargetId}
                    placeholder="เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    onChange={e => setTenantInfo({ ...tenantInfo, lineDefaultTargetId: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">LINE Notify Token (สำรอง / Legacy)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={tenantInfo.lineNotifyToken}
                    placeholder="Token สำหรับ LINE Notify (ถ้ามี)"
                    onChange={e => setTenantInfo({ ...tenantInfo, lineNotifyToken: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-modal-actions">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="card form-section-card p-6 md:p-8 space-y-6">
        <h3 className="settings-section-title-md font-bold text-lg border-b border-[var(--color-border)] pb-4">บัญชีผู้ใช้</h3>
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

      {/* ── SaaS Subscription & Quota Section ── */}
      {subscription && (
        <div className="card form-section-card p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
                <Crown size={20} className="text-[var(--color-primary)]" />
                แพ็กเกจและการใช้งาน (Subscription & Quota)
              </h3>
              <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
                ตรวจสอบโควต้าการใช้งานรายเดือนและจัดการแพ็กเกจขององค์กร
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-success">
                {subscription.currentPlan?.name || 'Pro Business'}
              </span>
              {subscription.subscriptionValidUntil && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  ใช้ได้ถึง {new Date(subscription.subscriptionValidUntil).toLocaleDateString('th-TH')}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span>จำนวนเอกสารที่ออกเดือนนี้</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {subscription.usage.currentMonthDocuments} / {subscription.usage.maxDocumentsPerMonth.toLocaleString('th-TH')} ฉบับ
                </span>
              </div>
              <div className="w-full h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (subscription.usage.currentMonthDocuments / Math.max(1, subscription.usage.maxDocumentsPerMonth)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span>จำนวนบัญชีผู้ใช้งาน (Active Users)</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {subscription.usage.currentUsers} / {subscription.usage.maxUsers.toLocaleString('th-TH')} บัญชี
                </span>
              </div>
              <div className="w-full h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (subscription.usage.currentUsers / Math.max(1, subscription.usage.maxUsers)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {subscription.availablePlans?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {subscription.availablePlans.map((plan) => {
                const isCurrent = subscription.currentPlan?.id === plan.id;
                let parsedFeatures: string[];
                try {
                  parsedFeatures = plan.features ? JSON.parse(plan.features) : [];
                } catch {
                  parsedFeatures = plan.features ? [plan.features] : [];
                }

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-4 ${
                      isCurrent
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]/40'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-solid)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-base text-[var(--color-text)]">{plan.name}</h4>
                        {isCurrent && <span className="badge badge-success text-xs">ปัจจุบัน</span>}
                      </div>
                      <p className="text-xl font-bold text-[var(--color-primary)] mt-2">
                        ฿{plan.monthlyPrice.toLocaleString('th-TH')}
                        <span className="text-xs font-normal text-[var(--color-text-muted)]"> / เดือน</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        ผู้ใช้งานสูงสุด {plan.maxUsers} คน • {plan.maxDocumentsPerMonth.toLocaleString('th-TH')} เอกสาร/เดือน
                      </p>
                      <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-secondary)]">
                        {parsedFeatures.map((feat, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      disabled={isCurrent || isUpgradingPlan === plan.id}
                      onClick={() => handleUpgradePlan(plan.id, plan.name)}
                      className={`btn w-full text-xs ${isCurrent ? 'btn-secondary opacity-60 cursor-default' : 'btn-primary'}`}
                    >
                      {isCurrent
                        ? 'แพ็กเกจปัจจุบัน'
                        : isUpgradingPlan === plan.id
                          ? 'กำลังดำเนินการ...'
                          : 'เลือกแพ็กเกจนี้'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card form-section-card p-6 md:p-8 space-y-6">
        <div>
          <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
            <Languages size={20} className="text-[var(--color-primary)]" />
            {t('settings.languageTitle')}
          </h3>
          <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
            {t('settings.languageDescription')}
          </p>
        </div>

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

      <div className="card form-section-card p-6 md:p-8 space-y-6">
        <div>
          <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
            <Bell size={20} className="text-[var(--color-primary)]" />
            การแจ้งเตือน (Push Notifications)
          </h3>
          <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
            รับการแจ้งเตือนเมื่อมีเอกสารใหม่ หรือการอัปเดตสถานะที่สำคัญ ผ่านเบราว์เซอร์และมือถือ
          </p>
        </div>

        <div className="p-4 border rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
          <div>
            <div className="settings-status-row font-semibold flex items-center gap-3">
              <span>สถานะ:</span>
              {pushNotifications.isSubscribed ? (
                <span className="badge badge-success"><Bell size={12} /> เปิดใช้งานแล้ว</span>
              ) : (
                <span className="badge badge-neutral"><BellOff size={12} /> ปิดอยู่</span>
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
