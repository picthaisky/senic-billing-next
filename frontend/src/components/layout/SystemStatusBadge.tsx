import { useAppSystem } from '../../hooks/useAppSystem';
import { Activity, CheckCircle, AlertTriangle, XCircle, WifiOff } from 'lucide-react';
import { useState } from 'react';

export default function SystemStatusBadge() {
  const { status, isConnected, components, lastChecked } = useAppSystem();
  const [showDetails, setShowDetails] = useState(false);

  // Determine icon and colors based on status
  let Icon = Activity;
  let colorClass = 'text-gray-400';
  let bgClass = 'bg-gray-100 dark:bg-gray-800';
  let badgeColor = 'bg-gray-400';
  let pulse = false;

  if (!isConnected) {
    Icon = WifiOff;
    colorClass = 'text-gray-500';
    badgeColor = 'bg-gray-500';
  } else if (status === 'Healthy') {
    Icon = CheckCircle;
    colorClass = 'text-green-600 dark:text-green-400';
    bgClass = 'bg-green-50 dark:bg-green-900/20';
    badgeColor = 'bg-green-500';
    pulse = true;
  } else if (status === 'Degraded') {
    Icon = AlertTriangle;
    colorClass = 'text-yellow-600 dark:text-yellow-400';
    bgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
    badgeColor = 'bg-yellow-500';
  } else if (status === 'Unhealthy') {
    Icon = XCircle;
    colorClass = 'text-red-600 dark:text-red-400';
    bgClass = 'bg-red-50 dark:bg-red-900/20';
    badgeColor = 'bg-red-500';
  }

  return (
    <div className="relative">
      <button 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${bgClass} ${colorClass} hover:opacity-80`}
        onClick={() => setShowDetails(!showDetails)}
        title="System Status"
      >
        <div className="relative flex h-2 w-2">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badgeColor}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badgeColor}`}></span>
        </div>
        <Icon size={14} />
        <span className="hidden sm:inline-block">
          {!isConnected ? 'Offline' : status}
        </span>
      </button>

      {/* Dropdown Details */}
      {showDetails && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)}></div>
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border dark:border-zinc-800 z-50 overflow-hidden animate-fade-in-up">
            <div className="p-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Activity size={16} /> System Monitoring
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {!isConnected ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  Disconnected from Real-time Server.
                </div>
              ) : components.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  No component data available.
                </div>
              ) : (
                components.map((c, i) => (
                  <div key={i} className="p-2 flex justify-between items-center border-b dark:border-zinc-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      {c.description && <div className="text-xs text-gray-500">{c.description}</div>}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${
                        c.status === 'Healthy' ? 'text-green-500' : 
                        c.status === 'Degraded' ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{Math.round(c.duration)}ms</span>
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
