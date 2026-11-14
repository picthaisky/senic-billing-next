import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, PackageOpen, Receipt, Megaphone, LogOut, Globe } from 'lucide-react';
import { useAdminLocale } from '../i18n/AdminLocaleContext';

interface SidebarProps {
  onLogout?: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const { locale, toggleLocale, t } = useAdminLocale();
  const menuItems = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: '/' },
    { icon: Users, label: t.nav.tenants, path: '/tenants' },
    { icon: PackageOpen, label: t.nav.packages, path: '/packages' },
    { icon: Receipt, label: t.nav.invoices, path: '/invoices' },
    { icon: Megaphone, label: t.nav.announcements, path: '/announcements' },
  ];

  return (
    <aside className="w-64 bg-[#1e293b] text-white flex flex-col h-full shadow-xl">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
          Senic Platform Admin
        </h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700/50 space-y-2">
        <button
          type="button"
          onClick={toggleLocale}
          data-testid="sidebar-locale-toggle"
          className="flex items-center justify-between px-4 py-2.5 w-full text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-sm"
        >
          <span className="flex items-center gap-3">
            <Globe size={18} />
            <span className="font-medium">{locale === 'th' ? 'ภาษาไทย (TH)' : 'English (EN)'}</span>
          </span>
          <span className="px-2 py-0.5 text-xs rounded bg-slate-700 text-blue-300 font-semibold">
            {locale === 'th' ? 'EN' : 'TH'}
          </span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <LogOut size={20} />
          <span className="font-medium">{t.nav.logout}</span>
        </button>
      </div>
    </aside>
  );
}
