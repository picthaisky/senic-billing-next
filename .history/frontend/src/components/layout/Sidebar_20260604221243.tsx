import {
  LayoutDashboard, Receipt, Banknote, Truck, FileText,
  Users, Package, Settings, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { id: 'divider-1', divider: true, label: 'เอกสาร' },
  { id: 'receipt', label: 'ใบเสร็จรับเงิน', icon: Receipt },
  { id: 'cashbill', label: 'บิลเงินสด', icon: Banknote },
  { id: 'delivery', label: 'ใบส่งของ', icon: Truck },
  { id: 'taxinvoice', label: 'ใบกำกับภาษี', icon: FileText },
  { id: 'divider-2', divider: true, label: 'ข้อมูลหลัก' },
  { id: 'customers', label: 'ลูกค้า', icon: Users },
  { id: 'products', label: 'สินค้า', icon: Package },
  { id: 'divider-3', divider: true, label: 'ระบบ' },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings },
];

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const user = useAuthStore((state) => state.user);

  const fullName = user
    ? user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'ผู้ดูแลระบบ'
    : 'ผู้ดูแลระบบ';

  const initials = user
    ? (
        (user.firstName?.[0] ?? user.displayName?.[0] ?? user.username?.[0] ?? '') +
        (user.lastName?.[0] ?? '')
      ).toUpperCase()
    : '';

  return (
    <aside
      className={`layout-sidebar fixed left-0 top-0 z-40 flex flex-col h-screen transition-all duration-300 ease-in-out ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
    >
      {/* Brand Logo */}
      <div className={`layout-sidebar-brand-row flex items-center gap-3 h-16 border-b border-white/10 ${collapsed ? 'layout-sidebar-brand-row--collapsed' : 'layout-sidebar-brand-row--expanded'}`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 bg-brand-gradient shadow-lg">
          <img src="/senic-favicon.svg" alt="Senic" className="w-5 h-5 object-contain" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <h1 className="layout-brand-wordmark text-white font-bold text-base tracking-tight leading-tight truncate">
              Senic<span className="text-[var(--sidebar-active-text)]">Billing</span>
            </h1>
            <p className="text-[10px] font-medium tracking-wider uppercase text-[var(--sidebar-text)] opacity-70">
              Next Generation
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="layout-sidebar-scroll layout-sidebar-nav-shell flex-1 overflow-y-auto">
        {navItems.map((item) => {
          if ('divider' in item && item.divider) {
            if (collapsed) return <div key={item.id} className="layout-sidebar-divider border-t border-white/10" />;
            return (
              <div key={item.id} className="layout-sidebar-section-label-wrap">
                <span className="layout-sidebar-group-label text-[10px] font-bold uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            );
          }

          const Icon = item.icon!;
          const isActive = currentPage === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`layout-sidebar-nav-item focus-ring relative w-full flex items-center gap-3 rounded-xl transition-all duration-200 group ${collapsed ? 'layout-sidebar-nav-item--collapsed' : 'layout-sidebar-nav-item--expanded'} ${isActive ? 'is-active' : ''}`}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="layout-sidebar-icon-wrap flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </span>
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="layout-sidebar-collapse-btn focus-ring absolute -right-3 top-[calc(var(--layout-header-height)+14px)] w-7 h-7 rounded-full border flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 z-10"
        aria-label={collapsed ? 'ขยายแถบเมนูด้านข้าง' : 'ย่อแถบเมนูด้านข้าง'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Footer — User identity */}
      <div className="layout-sidebar-footer layout-sidebar-footer-shell border-t border-white/10">
        <div className={`layout-sidebar-user flex items-center rounded-xl ${collapsed ? 'layout-sidebar-user--collapsed' : 'layout-sidebar-user--expanded'}`}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-brand-gradient shrink-0">
            {initials || <User size={16} />}
          </div>
          {!collapsed && (
            <div className="layout-sidebar-user-meta min-w-0 flex-1 animate-fade-in">
              <p className="text-xs font-semibold text-white truncate">{fullName}</p>
              <p className="text-[10px] text-[var(--sidebar-text)] opacity-60 truncate">
                {user?.email || user?.tenantName || 'บริษัท เซนิค'}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="layout-sidebar-version text-[10px] text-[var(--sidebar-text)] opacity-40 text-center">
            v1.0.0 — © 2026 Senic
          </p>
        )}
      </div>
    </aside>
  );
}
