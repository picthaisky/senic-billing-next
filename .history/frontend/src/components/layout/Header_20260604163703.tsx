import { Search, Bell, Sun, Moon, User, LogOut } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import SystemStatusBadge from './SystemStatusBadge';

interface HeaderProps {
  pageTitle: string;
  onNavigate?: (page: string) => void;
}

export default function Header({ pageTitle, onNavigate }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  
  // Use auth store to get user info
  const user = useAuthStore(state => state.user);

  return (
    <header
      className="h-16 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left: Page Title */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          {pageTitle}
        </h2>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-[420px] mx-8">
        <div className="relative w-full">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="ค้นหาเอกสาร, ลูกค้า, สินค้า..."
            className="input-field pl-10 !py-2 !text-sm !rounded-xl"
            style={{ background: 'var(--color-bg-secondary)' }}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <SystemStatusBadge />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-secondary)',
          }}
          title={theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon'}
        >
          {theme === 'warm-horizon' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-200 hover:scale-105"
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Bell size={18} />
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}
          >
            3
          </span>
        </button>

        {/* Profile */}
        <div className="relative ml-1">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200"
            style={{
              background: showProfile ? 'var(--color-surface-hover)' : 'transparent',
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--gradient-brand)' }}
            >
              <User size={16} />
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {user ? `${user.firstName} ${user.lastName}` : 'Admin'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {user?.email || 'Senic Corp'}
              </p>
            </div>
          </button>

          {showProfile && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border py-2 animate-fade-in"
              style={{
                background: 'var(--color-surface-solid)',
                borderColor: 'var(--color-border)',
              }}
            >
              <button 
                onClick={() => {
                  if (onNavigate) onNavigate('profile');
                  setShowProfile(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <User size={14} /> โปรไฟล์
              </button>
              <button 
                onClick={() => {
                  useAuthStore.getState().logout();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
