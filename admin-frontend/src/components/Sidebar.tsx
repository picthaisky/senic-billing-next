import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, PackageOpen, LogOut } from 'lucide-react';

export default function Sidebar() {
  const menuItems = [
    { icon: LayoutDashboard, label: 'ภาพรวม (Dashboard)', path: '/' },
    { icon: Users, label: 'ผู้ใช้บริการ (Tenants)', path: '/tenants' },
    { icon: PackageOpen, label: 'แพ็กเกจราคา (Packages)', path: '/packages' },
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

      <div className="p-4 border-t border-slate-700/50">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
          <LogOut size={20} />
          <span className="font-medium">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
}
