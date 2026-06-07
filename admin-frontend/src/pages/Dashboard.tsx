import { Users, Building2, CreditCard, Activity } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'ผู้ใช้บริการ (Tenants)', value: '12', change: '+2', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-100' },
    { label: 'ผู้ใช้งานระบบ (Users)', value: '148', change: '+12', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-100' },
    { label: 'รายได้เดือนนี้ (MRR)', value: '฿ 45,000', change: '+฿ 5,000', icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-100' },
    { label: 'ระบบ (System Status)', value: '99.9%', change: 'Healthy', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-100' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">ภาพรวมระบบ (Platform Dashboard)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
              <p className="text-sm font-medium text-emerald-500 mt-1">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
