import { X, Copy, CheckCircle2, MessageCircle } from 'lucide-react';
import { useState } from 'react';

interface ShareDocumentModalProps {
  documentId: string;
  documentNumber: string;
  onClose: () => void;
}

export default function ShareDocumentModal({ documentId, documentNumber, onClose }: ShareDocumentModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/print/${documentId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleLineShare = () => {
    const text = `เอกสารหมายเลข ${documentNumber} สามารถดูได้ที่: ${shareUrl}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--color-bg-primary)] w-full max-w-md rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-lg text-[var(--color-text)]">แชร์เอกสาร {documentNumber}</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">ลิงก์สาธารณะ (Public Link)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={shareUrl} 
                className="input-field flex-1 font-mono text-xs" 
              />
              <button 
                onClick={handleCopy}
                className="btn btn-secondary shrink-0 px-3"
              >
                {copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              ลิงก์นี้สามารถส่งให้ลูกค้าเปิดดูเอกสารและกดชำระเงินได้ทันทีโดยไม่ต้องล็อกอิน
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">แชร์ผ่านโซเชียล</label>
            <button 
              onClick={handleLineShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: '#00B900' }}
            >
              <MessageCircle size={20} />
              ส่งผ่าน LINE
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
