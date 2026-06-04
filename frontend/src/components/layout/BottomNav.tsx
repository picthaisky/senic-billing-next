import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Users, Package, Menu,
  Settings, Sun, Moon, LogOut, X, Banknote, Truck, FileText
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/useAuthStore';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const mainTabs = [
  { id: 'dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { id: 'receipt', label: 'ใบเสร็จ', icon: Receipt },
  { id: 'customers', label: 'ลูกค้า', icon: Users },
  { id: 'products', label: 'สินค้า', icon: Package },
];

const moreMenuItems = [
  { id: 'cashbill', label: 'บิลเงินสด', icon: Banknote },
  { id: 'delivery', label: 'ใบส่งของ', icon: Truck },
  { id: 'taxinvoice', label: 'ใบกำกับภาษี', icon: FileText },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings },
];

const moreMenuIds = moreMenuItems.map(i => i.id);

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { theme, toggleTheme } = useTheme();
  const [showMore, setShowMore] = useState(false);
  const isMoreActive = moreMenuIds.includes(currentPage);

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {mainTabs.map(({ id, label, icon: Icon }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                {isActive && (
                  <div
                    className="absolute top-0 w-10 h-0.5 rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    transition: 'color 0.2s, transform 0.2s',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    transition: 'color 0.2s',
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Menu
              size={22}
              strokeWidth={isMoreActive ? 2.5 : 1.8}
              style={{
                color: isMoreActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                transition: 'color 0.2s',
              }}
            />
            <span
              className="text-[10px] font-medium"
              style={{
                color: isMoreActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              เพิ่มเติม
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setShowMore(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden"
            style={{
              background: 'var(--color-surface-solid)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border)' }} />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>เมนูเพิ่มเติม</h3>
              <button onClick={() => setShowMore(false)} className="p-2 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="px-3 space-y-1">
              {moreMenuItems.map(({ id, label, icon: Icon }) => {
                const isActive = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => { onNavigate(id); setShowMore(false); }}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors text-left"
                    style={{
                      background: isActive ? 'rgba(234, 88, 12, 0.08)' : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                    }}
                  >
                    <Icon size={22} />
                    <span className="font-medium">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="px-3 pt-3 mt-2 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
              {/* Theme Toggle */}
              <button
                onClick={() => { toggleTheme(); setShowMore(false); }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors"
                style={{ color: 'var(--color-text)' }}
              >
                {theme === 'warm-horizon' ? <Moon size={22} /> : <Sun size={22} />}
                <span className="font-medium">
                  {theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon'}
                </span>
              </button>

              {/* Logout */}
              <button
                onClick={() => { useAuthStore.getState().logout(); setShowMore(false); }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={22} />
                <span className="font-medium">ออกจากระบบ</span>
              </button>

              <p className="text-center text-[10px] pt-1 select-none" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>
                Senic Billing v1.0.0
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
