// Shell: Sidebar + Header. Mirrors layout/Sidebar.tsx + Header.tsx.
const { useState } = React;

const NAV = [
  { id: 'dashboard', label: 'แดชบอร์ด', icon: 'LayoutDashboard' },
  { divider: 'เอกสาร' },
  { id: 'receipt', label: 'ใบเสร็จรับเงิน', icon: 'Receipt' },
  { id: 'cashbill', label: 'บิลเงินสด', icon: 'Banknote' },
  { id: 'delivery', label: 'ใบส่งของ', icon: 'Truck' },
  { id: 'taxinvoice', label: 'ใบกำกับภาษี', icon: 'FileText' },
  { divider: 'ข้อมูลหลัก' },
  { id: 'customers', label: 'ลูกค้า', icon: 'Users' },
  { id: 'products', label: 'สินค้า', icon: 'Package' },
  { divider: 'ระบบ' },
  { id: 'settings', label: 'ตั้งค่า', icon: 'Settings' },
];

function Sidebar({ page, onNav, collapsed, onToggle }) {
  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="sb-brand">
        <div className="sb-logo">S</div>
        {!collapsed && (
          <div className="animate-fade-in">
            <div className="sb-title">Senic<span>Billing</span></div>
            <div className="sb-sub">Next Generation</div>
          </div>
        )}
      </div>

      <nav className="sb-nav">
        {NAV.map((it, i) => {
          if (it.divider) return collapsed
            ? <div key={i} style={{ margin: '12px 8px', borderTop: '1px solid rgba(255,255,255,.1)' }} />
            : <div key={i} className="sb-grp">{it.divider}</div>;
          const Icon = Icons[it.icon];
          const active = page === it.id;
          return (
            <button key={it.id} className={'sb-item' + (active ? ' active' : '')}
              onClick={() => onNav(it.id)} title={collapsed ? it.label : undefined}>
              <Icon size={20} stroke={active ? 2.5 : 1.8} />
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>}
              {active && !collapsed && <span className="ind" />}
            </button>
          );
        })}
      </nav>

      <button className="sb-collapse" onClick={onToggle}>
        {collapsed ? <Icons.ChevronRight size={14} /> : <Icons.ChevronLeft size={14} />}
      </button>

      {!collapsed && <div className="sb-foot">v1.0.0 — © 2026 Senic</div>}
    </aside>
  );
}

const TITLES = {
  dashboard: 'แดชบอร์ด', receipt: 'ใบเสร็จรับเงิน', cashbill: 'บิลเงินสด',
  delivery: 'ใบส่งของ', taxinvoice: 'ใบกำกับภาษี', customers: 'ลูกค้า',
  products: 'สินค้า', settings: 'ตั้งค่า',
};

function Header({ page, theme, onToggleTheme, onNav, onLogout }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="header">
      <div className="h-title">{TITLES[page] || 'แดชบอร์ด'}</div>

      <div className="h-search">
        <Icons.Search size={16} />
        <input placeholder="ค้นหาเอกสาร, ลูกค้า, สินค้า..." />
      </div>

      <div className="h-actions">
        <span className="badge badge-success" style={{ marginRight: 4 }}>
          <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />ระบบพร้อมใช้งาน
        </span>
        <button className="h-icon-btn" onClick={onToggleTheme}
          title={theme === 'warm-horizon' ? 'เปลี่ยนเป็น Deep Ocean' : 'เปลี่ยนเป็น Warm Horizon'}>
          {theme === 'warm-horizon' ? <Icons.Moon size={18} /> : <Icons.Sun size={18} />}
        </button>
        <button className="h-icon-btn"><Icons.Bell size={18} /><span className="h-dot">3</span></button>

        <div style={{ position: 'relative', marginLeft: 4 }}>
          <button className="h-profile" onClick={() => setMenu(!menu)}
            style={{ background: menu ? 'var(--color-surface-hover)' : 'transparent' }}>
            <div className="h-avatar"><Icons.User size={16} /></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>สมหญิง ใจดี</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Senic Corp</div>
            </div>
          </button>
          {menu && (
            <div className="dropdown" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { onNav('settings'); setMenu(false); }}><Icons.User size={15} />โปรไฟล์</button>
              <button onClick={() => { onLogout(); setMenu(false); }}><Icons.LogOut size={15} />ออกจากระบบ</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Header });
