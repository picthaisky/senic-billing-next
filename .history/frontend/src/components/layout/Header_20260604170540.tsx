import { Search, Bell, Sun, Moon, User, LogOut } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import SystemStatusBadge from './SystemStatusBadge';

interface HeaderProps {
  pageTitle: string;
  onNavigate?: (page: string) => void;
}

export default function Header({ pageTitle, onNavigate }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Use auth store to get user info
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfile(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const themeToggleTitle = theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon';

  return (
    <header className="layout-header flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Left: Page Title */}
      <div>
        <h2 className="layout-header-title text-lg font-bold">
          {pageTitle}
        </h2>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-[420px] mx-8">
        <div className="relative w-full">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="ค้นหาเอกสาร, ลูกค้า, สินค้า..."
            aria-label="ค้นหาเอกสาร ลูกค้า หรือสินค้า"
            className="input-field layout-header-search pl-10 !py-2 !text-sm !rounded-xl"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <SystemStatusBadge />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          aria-label={themeToggleTitle}
          title={themeToggleTitle}
        >
          {theme === 'warm-horizon' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button
          className="layout-icon-btn focus-ring w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-200 hover:scale-105"
          aria-label="การแจ้งเตือน"
        >
          <Bell size={18} />
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-[var(--color-primary)]"
          >
            3
          </span>
        </button>

        {/* Profile */}
        <div className="relative ml-1" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`layout-profile-toggle focus-ring flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 ${showProfile ? 'is-open' : ''}`}
            aria-expanded={showProfile ? 'true' : 'false'}
            aria-haspopup="menu"
            aria-label="เมนูผู้ใช้งาน"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-brand-gradient">
              <User size={16} />
            </div>
            <div className="hidden lg:block text-left">
              <p className="layout-profile-name text-xs font-semibold">
                {user ? `${user.firstName} ${user.lastName}` : 'ผู้ดูแลระบบ'}
              </p>
              <p className="layout-profile-meta text-[10px]">
                {user?.email || 'บริษัท เซนิค'}
              </p>
            </div>
          </button>

          {showProfile && (
            <div
              className="layout-profile-menu absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border py-2 animate-fade-in"
              role="menu"
            >
              <button 
                onClick={() => {
                  if (onNavigate) onNavigate('profile');
                  setShowProfile(false);
                }}
                className="layout-profile-menu-item focus-ring w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                role="menuitem">
                <User size={14} /> โปรไฟล์
              </button>
              <button 
                onClick={() => {
                  useAuthStore.getState().logout();
                }}
                className="layout-profile-menu-item focus-ring w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                role="menuitem">
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
