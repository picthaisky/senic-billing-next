import {
  Search,
  Bell,
  Sun,
  Moon,
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
  const { theme, toggleTheme } = useTheme();
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
      new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
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
    theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon';

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  const dismissNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <header className="layout-header sticky top-0 z-30 px-3 sm:px-4 md:px-6">
      <div className="w-full max-w-[1200px] mx-auto h-full flex items-center justify-between gap-3">
        {/* Left: Page Title + contextual date */}
        <div className="min-w-0 pr-1">
          <h2 className="layout-header-title text-base md:text-lg font-bold leading-tight truncate">
            {pageTitle}
          </h2>
          <p className="layout-header-subtitle hidden sm:block text-[11px] leading-tight truncate">
            {todayLabel}
          </p>
        </div>

        {/* Center: Search Bar (desktop) */}
        <div className="hidden md:flex items-center flex-1 max-w-[440px] mx-4 lg:mx-6">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="ค้นหาเอกสาร, ลูกค้า, สินค้า..."
              aria-label="ค้นหาเอกสาร ลูกค้า หรือสินค้า"
              className="input-field layout-header-search pl-10 pr-16 !py-2 !text-sm !rounded-xl"
            />
            <kbd className="layout-search-kbd absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold pointer-events-none">
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
        <span className="layout-header-divider hidden sm:block h-6 w-px mx-0.5" />

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
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-[var(--color-primary)] ring-2 ring-[var(--color-surface)]">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="layout-profile-menu layout-notif-menu absolute right-0 top-full mt-2 w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl border overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">การแจ้งเตือน</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="focus-ring flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:opacity-80 rounded-md px-1 py-0.5"
                  >
                    <CheckCheck size={13} /> อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                    ไม่มีการแจ้งเตือน
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`layout-notif-item group relative flex gap-3 px-4 py-3 border-b last:border-0 border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-hover)] ${n.unread ? 'is-unread' : ''}`}
                    >
                      <span
                        className={`layout-notif-dot ${toneDotClass[n.tone]} mt-1.5 w-2 h-2 rounded-full flex-shrink-0`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug truncate">
                          {n.title}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-snug mt-0.5">
                          {n.detail}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                          {n.time}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissNotification(n.id)}
                        className="layout-notif-dismiss focus-ring opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md p-0.5 h-fit"
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
        <div className="relative ml-0.5" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowProfile((v) => !v);
              setShowNotifications(false);
            }}
            className={`layout-profile-toggle focus-ring flex items-center gap-2 px-1.5 sm:px-2 py-1 rounded-xl transition-all duration-200 ${showProfile ? 'is-open' : ''}`}
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
            <div className="layout-profile-menu layout-user-menu absolute right-0 top-full mt-2 w-60 rounded-2xl shadow-xl border overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
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

              <div className="py-1.5">
                <button
                  onClick={() => {
                    onNavigate?.('profile');
                    setShowProfile(false);
                  }}
                  className="layout-profile-menu-item focus-ring w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                >
                  <User size={15} /> โปรไฟล์ของฉัน
                </button>
                <button
                  onClick={() => {
                    onNavigate?.('settings');
                    setShowProfile(false);
                  }}
                  className="layout-profile-menu-item focus-ring w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                >
                  <Settings size={15} /> ตั้งค่าระบบ
                </button>
              </div>

              <div className="border-t border-[var(--color-border)] py-1.5">
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className="layout-profile-menu-item is-danger focus-ring w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                >
                  <LogOut size={15} /> ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Mobile search overlay bar */}
      {showMobileSearch && (
        <div className="layout-mobile-search md:hidden absolute left-0 right-0 top-full px-4 py-3 border-b animate-fade-in z-20">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ค้นหาเอกสาร, ลูกค้า, สินค้า..."
              aria-label="ค้นหาเอกสาร ลูกค้า หรือสินค้า"
              className="input-field layout-header-search pl-10 pr-10 !py-2 !text-sm !rounded-xl"
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md p-0.5"
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
