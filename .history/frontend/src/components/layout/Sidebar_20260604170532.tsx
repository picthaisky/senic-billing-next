import {
  LayoutDashboard, Receipt, Banknote, Truck, FileText,
  Users, Package, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'แดชบอร์ด', labelEn: 'Dashboard', icon: LayoutDashboard },
  { id: 'divider-1', divider: true, label: 'เอกสาร' },
  { id: 'receipt', label: 'ใบเสร็จรับเงิน', labelEn: 'Receipt', icon: Receipt },
  { id: 'cashbill', label: 'บิลเงินสด', labelEn: 'Cash Bill', icon: Banknote },
  { id: 'delivery', label: 'ใบส่งของ', labelEn: 'Delivery Note', icon: Truck },
  { id: 'taxinvoice', label: 'ใบกำกับภาษี', labelEn: 'Tax Invoice', icon: FileText },
  { id: 'divider-2', divider: true, label: 'ข้อมูลหลัก' },
  { id: 'customers', label: 'ลูกค้า', labelEn: 'Customers', icon: Users },
  { id: 'products', label: 'สินค้า', labelEn: 'Products', icon: Package },
  { id: 'divider-3', divider: true, label: 'ระบบ' },
  { id: 'settings', label: 'ตั้งค่า', labelEn: 'Settings', icon: Settings },
];

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {

  return (
    <aside
      className={`layout-sidebar fixed left-0 top-0 z-40 flex flex-col h-screen transition-all duration-300 ease-in-out ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ background: 'var(--gradient-brand)' }}>
          <img src="/senic-favicon.svg" alt="Senic" className="w-5 h-5 object-contain" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="layout-brand-wordmark text-white font-bold text-base tracking-tight leading-tight">
              Senic<span style={{ color: 'var(--sidebar-active-text)' }}>Billing</span>
            </h1>
            <p className="text-[10px] font-medium tracking-wider uppercase" style={{ color: 'var(--sidebar-text)' }}>
              Next Generation
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((item) => {
          if ('divider' in item && item.divider) {
            if (collapsed) return <div key={item.id} className="my-3 border-t border-white/10" />;
            return (
              <div key={item.id} className="px-3 py-2 mt-4 mb-1">
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
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`layout-sidebar-nav-item focus-ring w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 group ${isActive ? 'is-active' : ''}`}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} className="shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sidebar-active-text)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="layout-sidebar-collapse-btn focus-ring absolute -right-3 top-[78px] w-7 h-7 rounded-full border flex items-center justify-center bg-white shadow-md hover:shadow-lg transition-all duration-200 z-10"
        aria-label={collapsed ? 'ขยายแถบเมนูด้านข้าง' : 'ย่อแถบเมนูด้านข้าง'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Footer / Version */}
      {!collapsed && (
        <div className="px-5 py-3 border-t border-white/10">
          <p className="text-[10px] text-[var(--sidebar-text)] opacity-40">
            v1.0.0 — © 2026 Senic
          </p>
        </div>
      )}
    </aside>
  );
}
