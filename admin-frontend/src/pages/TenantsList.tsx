import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Ban, CheckCircle } from 'lucide-react';

export default function TenantsList() {
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/superadmin/tenants');
      if (res.data.success) {
        setTenants(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tenants', error);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'Active' ? 'suspend' : 'activate';
      await axios.post(`/api/superadmin/tenants/${id}/${action}`);
      fetchTenants();
    } catch (error) {
      console.error('Failed to toggle status', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">ผู้ใช้บริการ (Tenants)</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="ค้นหาลูกค้า..." 
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">ชื่อบริษัท</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">แพ็กเกจปัจจุบัน</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">สถานะ</th>
              <th className="py-4 px-6 text-sm font-semibold text-slate-600">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6">
                  <p className="font-semibold text-slate-800">{t.companyName}</p>
                  <p className="text-sm text-slate-500">{t.email}</p>
                </td>
                <td className="py-4 px-6">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {t.currentPlan}
                  </span>
                </td>
                <td className="py-4 px-6">
                  {t.subscriptionStatus === 'Active' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                      <CheckCircle size={14} /> Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-medium flex items-center gap-1 w-max">
                      <Ban size={14} /> {t.subscriptionStatus}
                    </span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <button 
                    onClick={() => toggleStatus(t.id, t.subscriptionStatus)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      t.subscriptionStatus === 'Active' 
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {t.subscriptionStatus === 'Active' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
