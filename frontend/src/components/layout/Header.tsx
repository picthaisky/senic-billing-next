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
  FileText,
  Users,
  Package,
  Receipt,
  ShoppingCart,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import SystemStatusBadge from './SystemStatusBadge';
import { useTranslation } from 'react-i18next';
import { useLocaleStore } from '../../store/useLocaleStore';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';

interface HeaderProps {
  pageTitle: string;
}

type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

interface NotificationFeedApiItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  occurredAt: string;
  tone: NotificationTone;
  route?: string | null;
}

interface NotificationItem extends NotificationFeedApiItem {
  unread: boolean;
}

interface GlobalSearchItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  badge?: string | null;
  route: string;
}

const toneDotClass: Record<NotificationTone, string> = {
  info: 'layout-notif-dot--info',
  success: 'layout-notif-dot--success',
  warning: 'layout-notif-dot--warning',
  danger: 'layout-notif-dot--danger bg-[var(--color-danger)]',
};

function readStoredIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredIdSet(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-200)));
  } catch {
    // Ignore storage quota errors
  }
}

export default function Header({ pageTitle }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const language = useLocaleStore((state) => state.language);
  const setLanguage = useLocaleStore((state) => state.setLanguage);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const notifStoragePrefix = user?.tenantId && user?.id
    ? `senic_notif_${user.tenantId}_${user.id}`
    : 'senic_notif_guest';
  const readKey = `${notifStoragePrefix}_read`;
  const dismissedKey = `${notifStoragePrefix}_dismissed`;

  const applyNotificationState = useCallback(
    (feed: NotificationFeedApiItem[]): NotificationItem[] => {
      const readSet = readStoredIdSet(readKey);
      const dismissedSet = readStoredIdSet(dismissedKey);
      return feed
        .filter((item) => !dismissedSet.has(item.id))
        .map((item) => ({
          ...item,
          tone: (item.tone || 'info') as NotificationTone,
          unread: !readSet.has(item.id),
        }));
    },
    [dismissedKey, readKey]
  );

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient.get<{ success: boolean; data: NotificationFeedApiItem[] }>(
        '/notifications/feed',
        { params: { limit: 15 } }
      );
      if (res.data?.success && Array.isArray(res.data.data)) {
        setNotifications(applyNotificationState(res.data.data));
      }
    } catch {
      // Keep current notifications on transient network error
    }
  }, [applyNotificationState, token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    apiClient
      .get<{ success: boolean; data: NotificationFeedApiItem[] }>('/notifications/feed', {
        params: { limit: 15 },
      })
      .then((res) => {
        if (active && res.data?.success && Array.isArray(res.data.data)) {
          setNotifications(applyNotificationState(res.data.data));
        }
      })
      .catch(() => {
        // Keep current notifications on transient network error
      });
    return () => {
      active = false;
    };
  }, [applyNotificationState, token]);

  useEffect(() => {
    const onLiveNotification = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationFeedApiItem>;
      const payload = customEvent.detail;
      if (!payload?.id) return;

      const dismissedSet = readStoredIdSet(dismissedKey);
      if (dismissedSet.has(payload.id)) {
        dismissedSet.delete(payload.id);
        writeStoredIdSet(dismissedKey, dismissedSet);
      }
      const readSet = readStoredIdSet(readKey);
      readSet.delete(payload.id);
      writeStoredIdSet(readKey, readSet);

      setNotifications((prev) => {
        const filtered = prev.filter((item) => item.id !== payload.id);
        const nextItem: NotificationItem = {
          ...payload,
          tone: (payload.tone || 'info') as NotificationTone,
          unread: true,
        };
        return [nextItem, ...filtered].slice(0, 20);
      });
    };

    window.addEventListener('senic:notification', onLiveNotification);
    return () => window.removeEventListener('senic:notification', onLiveNotification);
  }, [dismissedKey, readKey]);

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
    ? user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || t('header.defaultUserName')
    : t('header.defaultUserName');
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
      if (
        !desktopSearchWrapRef.current?.contains(target) &&
        !mobileSearchWrapRef.current?.contains(target)
      ) {
        setShowSearchResults(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfile(false);
        setShowNotifications(false);
        setShowSearchResults(false);
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
        setShowSearchResults(true);
        if (window.innerWidth >= 768) {
          requestAnimationFrame(() => desktopSearchInputRef.current?.focus());
        } else {
          setShowMobileSearch(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchInputChange = (nextValue: string) => {
    setSearchQuery(nextValue);
    if (!nextValue.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      setActiveSearchIndex(0);
    } else {
      setSearchLoading(Boolean(token));
      setShowSearchResults(true);
    }
  };

  // Debounced global search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !token) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: { query: string; items: GlobalSearchItem[] };
        }>('/search', { params: { q: trimmed, limit: 20 } });

        if (!cancelled && res.data?.success && res.data.data) {
          setSearchResults(res.data.data.items || []);
          setActiveSearchIndex(0);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, token]);

  const selectSearchResult = (item: GlobalSearchItem) => {
    setShowSearchResults(false);
    setShowMobileSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(item.route);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchResults || searchResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((prev) => (prev + 1) % searchResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = searchResults[activeSearchIndex];
      if (target) {
        selectSearchResult(target);
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'customer':
        return <Users size={15} className="text-[var(--color-primary)] shrink-0" />;
      case 'product':
        return <Package size={15} className="text-emerald-600 shrink-0" />;
      case 'expense':
        return <Receipt size={15} className="text-amber-600 shrink-0" />;
      case 'purchase_order':
        return <ShoppingCart size={15} className="text-indigo-500 shrink-0" />;
      default:
        return <FileText size={15} className="text-[var(--color-primary)] shrink-0" />;
    }
  };

  const renderSearchDropdown = () => {
    if (!showSearchResults || !searchQuery.trim()) return null;

    return (
      <div
        role="listbox"
        aria-label={t('header.searchAria')}
        className="layout-profile-menu layout-flyout-menu absolute left-0 right-0 top-full mt-2 rounded-2xl shadow-xl border overflow-hidden z-40"
      >
        {searchLoading ? (
          <div className="p-4 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            <span>{t('header.searchSearching')}</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
            {t('header.searchNoResults')}
          </div>
        ) : (
          <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--color-border)]">
            {searchResults.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={idx === activeSearchIndex}
                onMouseEnter={() => setActiveSearchIndex(idx)}
                onClick={() => selectSearchResult(item)}
                className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${
                  idx === activeSearchIndex
                    ? 'bg-[var(--color-surface-hover)]'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {getCategoryIcon(item.category)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-[var(--color-text)]">
                    {item.title}
                  </p>
                  <p className="text-xs truncate text-[var(--color-text-muted)]">
                    {item.subtitle}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] shrink-0">
                  {t(`header.searchCategories.${item.category}`, item.badge || item.category)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const themeToggleTitle =
    theme === 'warm-horizon' ? t('header.themeToOcean') : t('header.themeToWarm');

  const languageToggleTitle =
    language === 'th' ? t('header.languageToEnglish') : t('header.languageToThai');

  const toggleLanguage = () => {
    const nextLanguage = language === 'th' ? 'en' : 'th';
    setLanguage(nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  const markNotificationRead = (id: string) => {
    const readSet = readStoredIdSet(readKey);
    readSet.add(id);
    writeStoredIdSet(readKey, readSet);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const markAllRead = () => {
    const readSet = readStoredIdSet(readKey);
    notifications.forEach((n) => readSet.add(n.id));
    writeStoredIdSet(readKey, readSet);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const dismissNotification = (id: string) => {
    const dismissedSet = readStoredIdSet(dismissedKey);
    dismissedSet.add(id);
    writeStoredIdSet(dismissedKey, dismissedSet);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

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
        <div
          ref={desktopSearchWrapRef}
          className="layout-header-search-wrap hidden md:flex items-center flex-1 max-w-[440px] relative"
        >
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              ref={desktopSearchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setShowSearchResults(true)}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchAria')}
              className="input-field layout-header-search layout-header-search-input !text-sm !rounded-xl pr-14"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  handleSearchInputChange('');
                  desktopSearchInputRef.current?.focus();
                }}
                className="focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md p-0.5"
                aria-label={t('header.searchClearAria')}
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="layout-search-kbd layout-search-kbd-pill absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 rounded-md text-[10px] font-semibold pointer-events-none">
                <span className="text-xs leading-none">⌘</span>K
              </kbd>
            )}
          </div>
          {renderSearchDropdown()}
        </div>

        {/* Right: Actions */}
        <div className="layout-header-actions flex items-center gap-1.5 sm:gap-2">
        {/* Mobile search trigger */}
        <button
          type="button"
          onClick={() => {
            setShowMobileSearch((v) => !v);
            setShowSearchResults(true);
            requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
          className="layout-icon-btn focus-ring md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label={t('header.searchOpenAria')}
        >
          <Search size={18} />
        </button>

        <SystemStatusBadge />

        {/* Divider */}
        <span className="layout-header-divider layout-header-divider-spacer hidden sm:block h-6 w-px" />

        {/* Quick Help Center Link */}
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label={t('nav.help')}
          title={t('nav.help')}
          data-testid="header-help-btn"
        >
          <HelpCircle size={18} />
        </button>

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
              const nextOpen = !showNotifications;
              setShowNotifications(nextOpen);
              setShowProfile(false);
              if (nextOpen) {
                void fetchNotifications();
              }
            }}
            className={`layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-200 hover:scale-105 ${showNotifications ? 'is-open' : ''}`}
            aria-label={t('header.notificationsAria', { count: unreadCount })}
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
                  <h3 className="text-sm font-bold">{t('header.notificationsTitle')}</h3>
                  {unreadCount > 0 && (
                    <span className="layout-notif-count-badge text-[10px] font-bold text-white rounded-full bg-[var(--color-primary)]">
                      {t('header.notificationsNew', { count: unreadCount })}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="layout-notif-mark-read focus-ring flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:opacity-80 rounded-md"
                  >
                    <CheckCheck size={13} /> {t('header.notificationsMarkAll')}
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="layout-notif-empty text-center text-sm text-[var(--color-text-muted)]">
                    {t('header.notificationsEmpty')}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      role={n.route ? 'button' : undefined}
                      tabIndex={n.route ? 0 : undefined}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.route) {
                          setShowNotifications(false);
                          navigate(n.route);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (n.route && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          markNotificationRead(n.id);
                          setShowNotifications(false);
                          navigate(n.route);
                        }
                      }}
                      className={`layout-notif-item layout-notif-row group relative flex gap-3 border-b last:border-0 border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-hover)] ${n.route ? 'cursor-pointer' : ''} ${n.unread ? 'is-unread' : ''}`}
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
                          {n.timeLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(n.id);
                        }}
                        className="layout-notif-dismiss layout-notif-dismiss-btn focus-ring opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md h-fit"
                        aria-label={t('header.notificationsDismiss')}
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
            aria-label={t('header.userMenuAria')}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-brand-gradient">
              {initials || <User size={16} />}
            </div>
            <div className="hidden lg:block text-left max-w-[140px]">
              <p className="layout-profile-name text-xs font-semibold truncate">
                {fullName}
              </p>
              <p className="layout-profile-meta text-[10px] truncate">
                {user?.email || user?.tenantName || t('header.defaultCompanyName')}
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
                    {user?.email || t('header.defaultCompanyName')}
                  </p>
                </div>
              </div>

              <div className="layout-profile-menu-group">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowProfile(false);
                  }}
                  className="layout-profile-menu-item layout-profile-menu-item-pad focus-ring w-full flex items-center gap-2.5 text-sm transition-colors"
                >
                  <User size={15} /> {t('nav.profile')}
                </button>
                <button
                  onClick={() => {
                    navigate('/settings');
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
        <div
          ref={mobileSearchWrapRef}
          className="layout-mobile-search layout-mobile-search-panel layout-mobile-search-panel-shell md:hidden absolute left-0 right-0 top-full border-b z-20"
        >
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setShowSearchResults(true)}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchAria')}
              className="input-field layout-header-search layout-header-search-input-mobile !text-sm !rounded-xl"
            />
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setShowSearchResults(false);
              }}
              className="layout-mobile-search-close-btn focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md"
              aria-label={t('header.searchCloseAria')}
            >
              <X size={16} />
            </button>
            {renderSearchDropdown()}
          </div>
        </div>
      )}
    </header>
  );
}
