import { useState, useEffect } from 'react';
import { X, Clock, User, FileText, CheckCircle, Trash2, ArrowRight } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface AuditLog {
  id: string;
  username: string;
  action: string;
  entityName: string;
  entityId: string;
  oldValues: string | null;
  newValues: string | null;
  timestamp: string;
}

interface DocumentHistoryModalProps {
  documentId: string;
  documentNumber: string;
  onClose: () => void;
}

export default function DocumentHistoryModal({ documentId, documentNumber, onClose }: DocumentHistoryModalProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/documents/${documentId}/history`);
        if (res.data?.success) {
          setLogs(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch document history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [documentId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Added': return <CheckCircle size={16} className="text-green-500" />;
      case 'Modified': return <Clock size={16} className="text-blue-500" />;
      case 'Deleted': return <Trash2 size={16} className="text-red-500" />;
      default: return <FileText size={16} className="text-gray-500" />;
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'Added': return 'สร้างเอกสาร';
      case 'Modified': return 'แก้ไขเอกสาร';
      case 'Deleted': return 'ลบเอกสาร';
      default: return action;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface-solid)] w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock size={20} className="text-[var(--color-primary)]" />
              ประวัติการแก้ไขเอกสาร
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">เลขที่เอกสาร: {documentNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">กำลังโหลดประวัติ...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)] border border-dashed rounded-xl border-[var(--color-border)]">
              ไม่พบประวัติการแก้ไข
            </div>
          ) : (
            <div className="space-y-6">
              {logs.map((log, index) => (
                <div key={log.id} className="relative pl-6 border-l-2 border-[var(--color-border)] last:border-l-transparent pb-2">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--color-surface-solid)] border-2 border-[var(--color-border)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
                  </div>
                  
                  <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 -mt-1.5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 font-semibold">
                        {getActionIcon(log.action)}
                        {getActionText(log.action)}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] text-right">
                        <div>{new Date(log.timestamp).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <User size={12} /> {log.username}
                        </div>
                      </div>
                    </div>

                    {log.action === 'Modified' && log.oldValues && log.newValues && (
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-xs font-mono bg-[#1e1e1e] text-[#d4d4d4] rounded-lg p-3 overflow-x-auto">
                        <div className="text-[10px] text-gray-500 mb-2 font-sans uppercase tracking-wider">Changes Detail (JSON)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-red-400 mb-1">Old Values</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.oldValues), null, 2)}</pre>
                          </div>
                          <div>
                            <div className="text-green-400 mb-1">New Values</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.newValues), null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
