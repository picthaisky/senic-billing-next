import { useState, useEffect, useCallback } from 'react';
import { Building2, Mail, Phone, MapPin, Save, Bell, BellOff, Send, Languages, Crown, CheckCircle2, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import { useLocaleStore } from '../../store/useLocaleStore';
import RecurringInvoicesConfig from './RecurringInvoicesConfig';
import TenantBackupCard from './TenantBackupCard';
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/tenants/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.data?.logoUrl) {
        setTenantInfo((prev) => ({ ...prev, logoUrl: res.data.data.logoUrl }));
      }
    } catch (err) {
      alert(getApiErrorMessage(err, t('settings.logoUploadError')));
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await apiClient.get('/subscriptions/current');
      if (res.data?.success && res.data?.data?.usage) {
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
            branchName: d.branchName || '',
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
    if (!window.confirm(t('settings.confirmUpgradePlan', { planName }))) return;
    try {
      setIsUpgradingPlan(planId);
      await apiClient.post('/subscriptions/checkout', { planId, cardToken: '' });
      await fetchSubscription();
      alert(t('settings.upgradePlanSuccess', { planName }));
    } catch {
      alert(t('settings.upgradePlanError'));
    } finally {
      setIsUpgradingPlan(null);
    }
  };

  const handleTestLineNotify = async () => {
    try {
      const res = await apiClient.post('/tenants/test-line-notify');
      alert(res.data?.message || t('settings.lineTestSuccess'));
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, t('settings.lineTestError')));
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
      alert(t('settings.saveSuccess'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
      alert(t('settings.saveError'));
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
          <h2 className="text-lg font-bold leading-tight text-[var(--color-text)]">{t('settings.pageTitle')}</h2>
          <p className="settings-page-subtitle text-sm text-[var(--color-text-muted)]">{t('settings.pageSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
      <div className="card form-section-card lg:col-span-2 p-6 md:p-8 space-y-6">
        <h3 className="settings-section-title-lg font-bold text-lg flex items-center gap-2 border-b border-[var(--color-border)] pb-4">
          <Building2 size={22} className="text-[var(--color-primary)]" />
          {t('settings.tenantTitle')}
        </h3>
        
        <form onSubmit={handleSave} className="form-stack-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium">{t('settings.companyName')}</label>
              <input required type="text" className="input-field" value={tenantInfo.companyName} title={t('settings.companyName')} placeholder={t('settings.companyName')}
                onChange={e => setTenantInfo({...tenantInfo, companyName: e.target.value})} />
            </div>
            
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium">{t('settings.taxId')}</label>
              <input required type="text" className="input-field" value={tenantInfo.taxId} title={t('settings.taxId')} placeholder={t('settings.taxId')}
                onChange={e => setTenantInfo({...tenantInfo, taxId: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Mail size={14} className="text-[var(--color-text-muted)]" /> {t('settings.contactEmail')}
              </label>
              <input type="email" className="input-field" value={tenantInfo.email} title={t('settings.contactEmail')} placeholder="example@company.com"
                onChange={e => setTenantInfo({...tenantInfo, email: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <Phone size={14} className="text-[var(--color-text-muted)]" /> {t('settings.contactPhone')}
              </label>
              <input type="text" className="input-field" value={tenantInfo.phone} title={t('settings.contactPhone')} placeholder="02-123-4567"
                onChange={e => setTenantInfo({...tenantInfo, phone: e.target.value})} />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="layout-form-label-sm block text-sm font-medium">{t('settings.logoLabel')}</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-center overflow-hidden shrink-0">
                  {tenantInfo.logoUrl ? (
                    <img src={tenantInfo.logoUrl} alt="Company Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon size={24} className="text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
                      {isUploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {isUploadingLogo ? t('settings.logoUploading') : t('settings.logoUpload')}
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isUploadingLogo}
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>
                  <input type="text" className="input-field" value={tenantInfo.logoUrl} title="URL Logo" placeholder="https://example.com/logo.png"
                    onChange={e => setTenantInfo({...tenantInfo, logoUrl: e.target.value})} />
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">{t('settings.logoHint')}</p>
            </div>
            
            <div className="md:col-span-2 space-y-1.5">
              <label className="layout-form-label-sm block text-sm font-medium flex items-center gap-1">
                <MapPin size={14} className="text-[var(--color-text-muted)]" /> {t('settings.address')}
              </label>
              <textarea required className="input-field h-24 resize-none" value={tenantInfo.address} title={t('settings.address')} placeholder={t('settings.address')}
                onChange={e => setTenantInfo({...tenantInfo, address: e.target.value})} />
            </div>

            <div className="md:col-span-2 space-y-4 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">{t('settings.lineTitle')}</h4>
                  <p className="text-xs text-[var(--color-text-muted)]">{t('settings.lineSubtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestLineNotify}
                  className="btn btn-secondary whitespace-nowrap flex items-center gap-1.5 text-xs"
                >
                  <Send size={14} /> {t('settings.lineTestBtn')}
                </button>
              </div>

              {tenantId && (
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs space-y-1">
                  <div className="font-semibold text-[var(--color-text)]">{t('settings.lineWebhookTitle')}</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-[11px] break-all text-[var(--color-primary)]">
                      {`${window.location.origin}/api/webhooks/line/${tenantId}`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/line/${tenantId}`);
                        alert(t('settings.lineWebhookCopied'));
                      }}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      {t('settings.copyBtn')}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">
                    LINE Channel Access Token {hasLineAccessToken && <span className="text-emerald-600">{t('settings.lineConfigured')}</span>}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={tenantInfo.lineChannelAccessToken}
                    placeholder={hasLineAccessToken ? t('settings.lineAccessTokenPlaceholderSet') : t('settings.lineAccessTokenPlaceholder')}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineChannelAccessToken: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">
                    LINE Channel Secret {hasLineChannelSecret && <span className="text-emerald-600">{t('settings.lineConfigured')}</span>}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={tenantInfo.lineChannelSecret}
                    placeholder={hasLineChannelSecret ? t('settings.lineSecretPlaceholderSet') : t('settings.lineSecretPlaceholder')}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineChannelSecret: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">LINE Target ID (userId / groupId)</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={tenantInfo.lineDefaultTargetId}
                    placeholder={t('settings.lineTargetPlaceholder')}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineDefaultTargetId: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="layout-form-label-sm block text-xs font-medium">{t('settings.lineNotifyLegacyLabel')}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={tenantInfo.lineNotifyToken}
                    placeholder={t('settings.lineNotifyLegacyPlaceholder')}
                    onChange={e => setTenantInfo({ ...tenantInfo, lineNotifyToken: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-modal-actions">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={16} /> {isSaving ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </form>
      </div>
      
      <div className="card form-section-card p-6 md:p-8 space-y-6">
        <h3 className="settings-section-title-md font-bold text-lg border-b border-[var(--color-border)] pb-4">{t('settings.accountTitle')}</h3>
        <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)]">
          {t('settings.accountSubtitle')}
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
      {subscription?.usage && (
        <div className="card form-section-card p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-4">
            <div>
              <h3 className="settings-section-title-md font-bold text-lg flex items-center gap-2">
                <Crown size={20} className="text-[var(--color-primary)]" />
                {t('settings.subscriptionTitle')}
              </h3>
              <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
                {t('settings.subscriptionSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-success">
                {subscription.currentPlan?.name || 'Pro Business'}
              </span>
              {subscription.subscriptionValidUntil && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t('settings.validUntil', { date: new Date(subscription.subscriptionValidUntil).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'th-TH') })}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span>{t('settings.quotaDocsLabel')}</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {subscription.usage.currentMonthDocuments} / {subscription.usage.maxDocumentsPerMonth.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH')} {t('settings.quotaDocsUnit')}
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
                <span>{t('settings.quotaUsersLabel')}</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {subscription.usage.currentUsers} / {subscription.usage.maxUsers.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH')} {t('settings.quotaUsersUnit')}
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
                        {isCurrent && <span className="badge badge-success text-xs">{t('settings.currentBadge')}</span>}
                      </div>
                      <p className="text-xl font-bold text-[var(--color-primary)] mt-2">
                        ฿{plan.monthlyPrice.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH')}
                        <span className="text-xs font-normal text-[var(--color-text-muted)]"> {t('settings.perMonth')}</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {t('settings.planLimitsSummary', { maxUsers: plan.maxUsers, maxDocs: plan.maxDocumentsPerMonth.toLocaleString(i18n.language === 'en' ? 'en-US' : 'th-TH') })}
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
                        ? t('settings.currentPlanBtn')
                        : isUpgradingPlan === plan.id
                          ? t('settings.upgradingPlanBtn')
                          : t('settings.selectPlanBtn')}
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
            {t('settings.pushTitle')}
          </h3>
          <p className="settings-section-subtitle text-sm text-[var(--color-text-muted)] mt-1">
            {t('settings.pushSubtitle')}
          </p>
        </div>

        <div className="p-4 border rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
          <div>
            <div className="settings-status-row font-semibold flex items-center gap-3">
              <span>{t('settings.pushStatus')}</span>
              {pushNotifications.isSubscribed ? (
                <span className="badge badge-success"><Bell size={12} /> {t('settings.pushEnabled')}</span>
              ) : (
                <span className="badge badge-neutral"><BellOff size={12} /> {t('settings.pushDisabled')}</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {pushNotifications.isSupported
                ? t('settings.pushSupported')
                : t('settings.pushUnsupported')}
            </p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            {pushNotifications.isSubscribed ? (
              <>
                <button 
                  onClick={() => pushNotifications.sendTestNotification()} 
                  className="btn btn-secondary flex-1 md:flex-none"
                >
                  <Send size={16} /> {t('settings.pushTest')}
                </button>
                <button
                  onClick={() => pushNotifications.unsubscribe()}
                  className="btn flex-1 md:flex-none text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                >
                  <BellOff size={16} /> {t('settings.pushTurnOff')}
                </button>
              </>
            ) : (
              <button 
                onClick={() => pushNotifications.subscribe()} 
                disabled={!pushNotifications.isSupported}
                className="btn btn-primary flex-1 md:flex-none"
              >
                <Bell size={16} /> {t('settings.pushTurnOn')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recurring Invoices */}
      <RecurringInvoicesConfig />

      {/* Admin Tenant Backup Export */}
      <TenantBackupCard />
    </div>
  );
}
