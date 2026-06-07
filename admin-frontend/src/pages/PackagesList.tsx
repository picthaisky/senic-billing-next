import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Package } from 'lucide-react';

export default function PackagesList() {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get('/api/superadmin/plans');
      if (res.data.success) {
        setPlans(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แพ็กเกจราคา (Subscription Plans)</h1>
          <p className="text-slate-500 mt-1">จัดการแพ็กเกจและข้อจำกัด Quota ของแต่ละระดับ</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors">
          <Plus size={20} /> เพิ่มแพ็กเกจใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            {!plan.isActive && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-md">
                Inactive
              </div>
            )}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">฿{plan.monthlyPrice.toLocaleString()}</span>
                <span className="text-slate-500 font-medium">/เดือน</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">หรือ ฿{plan.yearlyPrice.toLocaleString()}/ปี</p>
            </div>
            
            <div className="p-6 flex-1 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">ผู้ใช้งานสูงสุด</span>
                <span className="font-semibold text-slate-800">{plan.maxUsers === -1 ? 'ไม่จำกัด' : `${plan.maxUsers} บัญชี`}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">โควต้าเอกสารรายเดือน</span>
                <span className="font-semibold text-slate-800">{plan.maxDocumentsPerMonth === -1 ? 'ไม่จำกัด' : `${plan.maxDocumentsPerMonth} ใบ`}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button className="w-full flex justify-center items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors py-2">
                <Edit2 size={16} /> แก้ไขแพ็กเกจ
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500">
            ยังไม่มีข้อมูลแพ็กเกจ
          </div>
        )}
      </div>
    </div>
  );
}
