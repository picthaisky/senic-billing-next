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
      <nav className="layout-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {mainTabs.map(({ id, label, icon: Icon }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`layout-bottom-nav-item haptic-tap flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative ${isActive ? 'is-active' : ''}`}
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
            className={`layout-bottom-nav-item haptic-tap flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${isMoreActive ? 'is-active' : ''}`}
          >
            <Menu
              size={22}
              strokeWidth={isMoreActive ? 2.5 : 1.8}
              className="layout-bottom-nav-icon"
            />
            <span className="layout-bottom-nav-label text-[10px] font-medium">
              เพิ่มเติม
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
            <div className="flex justify-center pt-3 pb-2">
              <div className="layout-bottom-sheet-handle w-10 h-1 rounded-full" />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="font-semibold text-base text-[var(--color-text)]">เมนูเพิ่มเติม</h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="ปิดเมนูเพิ่มเติม"
                title="ปิดเมนูเพิ่มเติม"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="layout-bottom-sheet-list">
              {moreMenuItems.map(({ id, label, icon: Icon }) => {
                const isActive = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => { onNavigate(id); setShowMore(false); }}
                    className={`layout-bottom-sheet-item haptic-tap flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors text-left ${isActive ? 'is-active' : ''}`}
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
                className="layout-bottom-sheet-item haptic-tap flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors text-[var(--color-text)]"
              >
                {theme === 'warm-horizon' ? <Moon size={22} /> : <Sun size={22} />}
                <span className="font-medium">
                  {theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon'}
                </span>
              </button>

              {/* Logout */}
              <button
                onClick={() => { useAuthStore.getState().logout(); setShowMore(false); }}
                className="layout-bottom-sheet-item haptic-tap flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-colors text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              >
                <LogOut size={22} />
                <span className="font-medium">ออกจากระบบ</span>
              </button>

              <p className="text-center text-[10px] pt-1 select-none text-[var(--color-text-muted)] opacity-40">
                Senic Billing v1.0.0
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
