import {
  Search,
  Bell,
  Sun,
  Moon,
  Languages,
  User,
  LogOut,
  Settings,
  CheckCheck,
  X,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import SystemStatusBadge from './SystemStatusBadge';
import { useTranslation } from 'react-i18next';
import { useLocaleStore } from '../../store/useLocaleStore';

interface HeaderProps {
  pageTitle: string;
  onNavigate?: (page: string) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  tone: 'info' | 'success' | 'warning';
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'รับชำระเงินสำเร็จ',
    detail: 'ใบเสร็จ #RC-2024-0142 ได้รับการชำระแล้ว ฿12,500',
    time: '5 นาทีที่แล้ว',
    unread: true,
    tone: 'success',
  },
  {
    id: 'n2',
    title: 'ใบกำกับภาษีใกล้ครบกำหนด',
    detail: 'ใบกำกับ #TX-2024-0098 ครบกำหนดชำระในอีก 2 วัน',
    time: '1 ชั่วโมงที่แล้ว',
    unread: true,
    tone: 'warning',
  },
  {
    id: 'n3',
    title: 'ลูกค้าใหม่ถูกเพิ่ม',
    detail: 'บริษัท ไทยพัฒนา จำกัด ถูกเพิ่มเข้าระบบแล้ว',
    time: 'เมื่อวานนี้',
    unread: false,
    tone: 'info',
  },
];

const toneDotClass: Record<NotificationItem['tone'], string> = {
  info: 'layout-notif-dot--info',
  success: 'layout-notif-dot--success',
  warning: 'layout-notif-dot--warning',
};

export default function Header({ pageTitle, onNavigate }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const language = useLocaleStore((state) => state.language);
  const setLanguage = useLocaleStore((state) => state.setLanguage);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const user = useAuthStore((state) => state.user);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(language === 'en' ? 'en-GB' : 'th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [language]
  );

  const fullName = user
    ? user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'ผู้ดูแลระบบ'
    : 'ผู้ดูแลระบบ';
  const initials = user
    ? (
        (user.firstName?.[0] ?? user.displayName?.[0] ?? user.username?.[0] ?? '') +
        (user.lastName?.[0] ?? '')
      ).toUpperCase()
    : '';

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target)) setShowProfile(false);
      if (!notificationsRef.current?.contains(target)) setShowNotifications(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfile(false);
        setShowNotifications(false);
        setShowMobileSearch(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  // Cmd/Ctrl + K to focus search
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowMobileSearch(true);
        // Wait for the mobile input to mount before focusing
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const themeToggleTitle =
    theme === 'warm-horizon' ? t('header.themeToOcean') : t('header.themeToWarm');

  const languageToggleTitle =
    language === 'th' ? t('header.languageToEnglish') : t('header.languageToThai');

  const toggleLanguage = () => {
    const nextLanguage = language === 'th' ? 'en' : 'th';
    setLanguage(nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  const dismissNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <header className="layout-header app-header sticky top-0 z-30">
      <div className="app-page-container app-header-inner">
        {/* Left: Page Title + contextual date */}
        <div className="min-w-0 layout-header-title-wrap">
          <h2 className="layout-header-title text-base md:text-lg font-bold leading-tight truncate">
            {pageTitle}
          </h2>
          <p className="layout-header-subtitle hidden sm:block text-[11px] leading-tight truncate">
            {todayLabel}
          </p>
        </div>

        {/* Center: Search Bar (desktop) */}
        <div className="layout-header-search-wrap hidden md:flex items-center flex-1 max-w-[440px]">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchAria')}
              className="input-field layout-header-search layout-header-search-input !text-sm !rounded-xl"
            />
            <kbd className="layout-search-kbd layout-search-kbd-pill absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 rounded-md text-[10px] font-semibold pointer-events-none">
              <span className="text-xs leading-none">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="layout-header-actions flex items-center gap-1.5 sm:gap-2">
        {/* Mobile search trigger */}
        <button
          type="button"
          onClick={() => {
            setShowMobileSearch((v) => !v);
            requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
          className="layout-icon-btn focus-ring md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label="ค้นหา"
        >
          <Search size={18} />
        </button>

        <SystemStatusBadge />

        {/* Divider */}
        <span className="layout-header-divider layout-header-divider-spacer hidden sm:block h-6 w-px" />

        {/* Language Toggle */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label={languageToggleTitle}
          title={languageToggleTitle}
        >
          <Languages size={18} />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label={themeToggleTitle}
          title={themeToggleTitle}
        >
          {theme === 'warm-horizon' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((v) => !v);
              setShowProfile(false);
            }}
            className={`layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-200 hover:scale-105 ${showNotifications ? 'is-open' : ''}`}
            aria-label={`การแจ้งเตือน${unreadCount ? ` (${unreadCount} รายการใหม่)` : ''}`}
            aria-haspopup="true"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="layout-header-notif-badge absolute rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-[var(--color-primary)] ring-2 ring-[var(--color-surface)]">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="layout-profile-menu layout-flyout-menu layout-flyout-offset layout-notif-menu absolute right-0 top-full w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl border overflow-hidden">
              <div className="layout-notif-head flex items-center justify-between border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">การแจ้งเตือน</h3>
                  {unreadCount > 0 && (
                    <span className="layout-notif-count-badge text-[10px] font-bold text-white rounded-full bg-[var(--color-primary)]">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="layout-notif-mark-read focus-ring flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:opacity-80 rounded-md"
                  >
                    <CheckCheck size={13} /> อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="layout-notif-empty text-center text-sm text-[var(--color-text-muted)]">
                    ไม่มีการแจ้งเตือน
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`layout-notif-item layout-notif-row group relative flex gap-3 border-b last:border-0 border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-hover)] ${n.unread ? 'is-unread' : ''}`}
                    >
                      <span
                        className={`layout-notif-dot layout-notif-dot-align ${toneDotClass[n.tone]} w-2 h-2 rounded-full flex-shrink-0`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug truncate">
                          {n.title}
                        </p>
                        <p className="layout-notif-detail text-xs text-[var(--color-text-secondary)] leading-snug">
                          {n.detail}
                        </p>
                        <p className="layout-notif-time text-[10px] text-[var(--color-text-muted)]">
                          {n.time}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissNotification(n.id)}
                        className="layout-notif-dismiss layout-notif-dismiss-btn focus-ring opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md h-fit"
                        aria-label="ลบการแจ้งเตือน"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative layout-profile-wrap" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowProfile((v) => !v);
              setShowNotifications(false);
            }}
            className={`layout-profile-toggle layout-profile-toggle-padding focus-ring flex items-center gap-2 rounded-xl transition-all duration-200 ${showProfile ? 'is-open' : ''}`}
            aria-haspopup="true"
            aria-label="เมนูผู้ใช้งาน"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-brand-gradient">
              {initials || <User size={16} />}
            </div>
            <div className="hidden lg:block text-left max-w-[140px]">
              <p className="layout-profile-name text-xs font-semibold truncate">
                {fullName}
              </p>
              <p className="layout-profile-meta text-[10px] truncate">
                {user?.email || user?.tenantName || 'บริษัท เซนิค'}
              </p>
            </div>
          </button>

          {showProfile && (
            <div className="layout-profile-menu layout-flyout-menu layout-flyout-offset layout-user-menu absolute right-0 top-full w-60 rounded-2xl shadow-xl border overflow-hidden">
              {/* Header */}
              <div className="layout-profile-menu-head flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-brand-gradient flex-shrink-0">
                  {initials || <User size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="layout-profile-name text-sm font-semibold truncate">
                    {fullName}
                  </p>
                  <p className="layout-profile-meta text-[11px] truncate">
                    {user?.email || 'บริษัท เซนิค'}
                  </p>
                </div>
              </div>

              <div className="layout-profile-menu-group">
                <button
                  onClick={() => {
                    onNavigate?.('profile');
                    setShowProfile(false);
                  }}
                  className="layout-profile-menu-item layout-profile-menu-item-pad focus-ring w-full flex items-center gap-2.5 text-sm transition-colors"
                >
                  <User size={15} /> {t('nav.profile')}
                </button>
                <button
                  onClick={() => {
                    onNavigate?.('settings');
                    setShowProfile(false);
                  }}
                  className="layout-profile-menu-item layout-profile-menu-item-pad focus-ring w-full flex items-center gap-2.5 text-sm transition-colors"
                >
                  <Settings size={15} /> {t('nav.settings')}
                </button>
              </div>

              <div className="layout-profile-menu-group border-t border-[var(--color-border)]">
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className="layout-profile-menu-item layout-profile-menu-item-pad is-danger focus-ring w-full flex items-center gap-2.5 text-sm transition-colors"
                >
                  <LogOut size={15} /> {t('auth.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Mobile search overlay bar */}
      {showMobileSearch && (
        <div className="layout-mobile-search layout-mobile-search-panel layout-mobile-search-panel-shell md:hidden absolute left-0 right-0 top-full border-b z-20">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchAria')}
              className="input-field layout-header-search layout-header-search-input-mobile !text-sm !rounded-xl"
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="layout-mobile-search-close-btn focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md"
              aria-label="ปิดการค้นหา"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
