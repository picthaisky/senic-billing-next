import { useAppSystem } from '../../hooks/useAppSystem';
import { Activity, CheckCircle, AlertTriangle, XCircle, WifiOff } from 'lucide-react';
import { useState } from 'react';

export default function SystemStatusBadge() {
  const { status, isConnected, components, lastChecked } = useAppSystem();
  const [showDetails, setShowDetails] = useState(false);

  const statusLabel: Record<string, string> = {
    Healthy: 'พร้อมใช้งาน',
    Degraded: 'บางส่วนช้าลง',
    Unhealthy: 'มีปัญหา',
  };

  // Determine icon and colors based on status
  let Icon = Activity;
  let colorClass = 'text-[var(--color-text-muted)]';
  let bgClass = 'bg-[var(--color-bg-secondary)]';
  let badgeColor = 'bg-[var(--color-text-muted)]';
  let pulse = false;

  if (!isConnected) {
    Icon = WifiOff;
    colorClass = 'text-[var(--color-danger)]';
    bgClass = 'bg-[var(--color-danger-bg)]';
    badgeColor = 'bg-red-500';
  } else if (status === 'Healthy') {
    Icon = CheckCircle;
    colorClass = 'text-[var(--color-success)]';
    bgClass = 'bg-[var(--color-success-bg)]';
    badgeColor = 'bg-green-500';
    pulse = true;
  } else if (status === 'Degraded') {
    Icon = AlertTriangle;
    colorClass = 'text-[var(--color-warning)]';
    bgClass = 'bg-[var(--color-warning-bg)]';
    badgeColor = 'bg-yellow-500';
  } else if (status === 'Unhealthy') {
    Icon = XCircle;
    colorClass = 'text-[var(--color-danger)]';
    bgClass = 'bg-[var(--color-danger-bg)]';
    badgeColor = 'bg-red-500';
  }

  return (
    <div className="relative">
      <button 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${bgClass} ${colorClass} hover:opacity-80`}
        onClick={() => setShowDetails(!showDetails)}
        title="สถานะระบบ"
      >
        <div className="relative flex h-2 w-2">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badgeColor}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badgeColor}`}></span>
        </div>
        <Icon size={14} />
        <span className="hidden sm:inline-block">
          {!isConnected ? 'ออฟไลน์' : (statusLabel[status] ?? status)}
        </span>
      </button>

      {/* Dropdown Details */}
      {showDetails && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)}></div>
          <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl border z-50 overflow-hidden animate-fade-in-up" style={{ backgroundColor: 'var(--color-surface-solid)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
            <div className="p-3 border-b" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Activity size={16} /> การติดตามสถานะระบบ
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                ตรวจสอบล่าสุด: {lastChecked ? lastChecked.toLocaleTimeString('th-TH') : 'ยังไม่มีข้อมูล'}
              </p>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {!isConnected ? (
                <div className="p-3 text-sm text-[var(--color-text-muted)] text-center">
                  ไม่ได้เชื่อมต่อกับเซิร์ฟเวอร์แบบเรียลไทม์
                </div>
              ) : components.length === 0 ? (
                <div className="p-3 text-sm text-[var(--color-text-muted)] text-center">
                  ยังไม่มีข้อมูลสถานะของบริการ
                </div>
              ) : (
                components.map((c, i) => (
                  <div key={i} className="p-2 flex justify-between items-center border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      {c.description && <div className="text-xs text-[var(--color-text-muted)]">{c.description}</div>}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${
                        c.status === 'Healthy' ? 'text-green-500' : 
                        c.status === 'Degraded' ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{Math.round(c.duration)}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
