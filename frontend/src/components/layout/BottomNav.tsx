import {
  LayoutDashboard, Receipt, Users, Package, Menu,
  Settings, Sun, Moon, LogOut, X, Banknote, Truck, FileText, FileCheck
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNav() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mainTabs = [
    { id: 'dashboard', path: '/dashboard', label: t('nav.home'), icon: LayoutDashboard },
    { id: 'receipt', path: '/documents/receipt', label: t('nav.receipt'), icon: Receipt },
    { id: 'customers', path: '/customers', label: t('nav.customers'), icon: Users },
    { id: 'products', path: '/products', label: t('nav.products'), icon: Package },
  ];

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SystemAdmin';

  const moreMenuItems = [
    { id: 'cashbill', path: '/documents/cashbill', label: t('nav.cashbill'), icon: Banknote },
    { id: 'delivery', path: '/documents/delivery', label: t('nav.delivery'), icon: Truck },
    { id: 'quotation', path: '/documents/quotation', label: t('nav.quotation'), icon: FileText },
    { id: 'taxinvoice', path: '/documents/taxinvoice', label: t('nav.taxinvoice'), icon: FileCheck },
    { id: 'settings', path: '/settings', label: t('nav.settings'), icon: Settings },
    ...(isAdmin ? [{ id: 'users', path: '/users', label: 'จัดการผู้ใช้งาน', icon: Users }] : []),
  ];

  const moreMenuPaths = moreMenuItems.map(i => i.path);
  const isMoreActive = moreMenuPaths.some(p => location.pathname.startsWith(p));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="layout-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="layout-bottom-nav-shell flex items-center justify-around h-16">
          {mainTabs.map(({ id, path, label, icon: Icon }) => {
            const isActive = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                className={`layout-bottom-nav-item layout-bottom-nav-tab haptic-tap flex flex-col items-center justify-center gap-0.5 flex-1 relative ${isActive ? 'is-active' : ''}`}
              >
                {isActive && (
                  <div className="layout-bottom-nav-active-bar absolute top-0 w-10 h-0.5 rounded-full" />
                )}
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className="layout-bottom-nav-icon"
                />
                <span className="layout-bottom-nav-label text-[10px] font-medium">
                  {label}
                </span>
              </button>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`layout-bottom-nav-item layout-bottom-nav-tab haptic-tap flex flex-col items-center justify-center gap-0.5 flex-1 ${isMoreActive ? 'is-active' : ''}`}
          >
            <Menu
              size={22}
              strokeWidth={isMoreActive ? 2.5 : 1.8}
              className="layout-bottom-nav-icon"
            />
            <span className="layout-bottom-nav-label text-[10px] font-medium">
              {t('nav.more')}
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setShowMore(false)} />
          <div className="layout-bottom-sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden">
            {/* Drag Handle */}
            <div className="layout-bottom-sheet-handle-wrap flex justify-center">
              <div className="layout-bottom-sheet-handle w-10 h-1 rounded-full" />
            </div>

            {/* Title */}
            <div className="layout-bottom-sheet-title-row flex items-center justify-between">
              <h3 className="font-semibold text-base text-[var(--color-text)]">{t('nav.more')}</h3>
              <button
                onClick={() => setShowMore(false)}
                className="layout-bottom-sheet-close rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="ปิดเมนูเพิ่มเติม"
                title="ปิดเมนูเพิ่มเติม"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="layout-bottom-sheet-list">
              {moreMenuItems.map(({ id, path, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(path);
                return (
                  <button
                    key={id}
                    onClick={() => { navigate(path); setShowMore(false); }}
                    className={`layout-bottom-sheet-item layout-bottom-sheet-item-row haptic-tap flex items-center gap-4 w-full rounded-xl transition-colors text-left ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon size={22} />
                    <span className="font-medium">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="layout-bottom-sheet-footer layout-bottom-sheet-footer-stack">
              {/* Theme Toggle */}
              <button
                onClick={() => { toggleTheme(); setShowMore(false); }}
                className="layout-bottom-sheet-item layout-bottom-sheet-item-row haptic-tap flex items-center gap-4 w-full rounded-xl transition-colors text-[var(--color-text)]"
              >
                {theme === 'warm-horizon' ? <Moon size={22} /> : <Sun size={22} />}
                <span className="font-medium">
                  {theme === 'warm-horizon' ? t('theme.toOcean') : t('theme.toWarm')}
                </span>
              </button>

              {/* Logout */}
              <button
                onClick={() => { useAuthStore.getState().logout(); setShowMore(false); }}
                className="layout-bottom-sheet-item layout-bottom-sheet-item-row haptic-tap flex items-center gap-4 w-full rounded-xl transition-colors text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              >
                <LogOut size={22} />
                <span className="font-medium">{t('auth.logout')}</span>
              </button>

              <p className="layout-bottom-sheet-version text-center text-[10px] select-none text-[var(--color-text-muted)] opacity-40">
                Senic Billing v1.0.0
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
