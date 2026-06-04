import { useState } from 'react';
import { Plus, X, Receipt, Banknote, Truck, FileText } from 'lucide-react';
import { DOCUMENT_TYPE_META, type DocumentTypeId } from '../../utils/documentTypeMeta';

interface FloatingActionButtonProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface FabAction {
  id: DocumentTypeId;
  label: string;
  icon: React.ElementType;
  color: string;
}

const quickActions: FabAction[] = [
  { id: 'receipt', label: DOCUMENT_TYPE_META.receipt.label, icon: Receipt, color: DOCUMENT_TYPE_META.receipt.color },
  { id: 'cashbill', label: DOCUMENT_TYPE_META.cashbill.label, icon: Banknote, color: DOCUMENT_TYPE_META.cashbill.color },
  { id: 'delivery', label: DOCUMENT_TYPE_META.delivery.label, icon: Truck, color: DOCUMENT_TYPE_META.delivery.color },
  { id: 'taxinvoice', label: DOCUMENT_TYPE_META.taxinvoice.label, icon: FileText, color: DOCUMENT_TYPE_META.taxinvoice.color },
];

export default function FloatingActionButton({ currentPage, onNavigate }: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Hide FAB on document form pages (user is already creating a doc)
  const hiddenPages = ['receipt', 'cashbill', 'delivery', 'taxinvoice', 'settings', 'profile'];
  if (hiddenPages.includes(currentPage)) return null;

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Quick Action Items */}
      {isExpanded && (
        <div
          className="fixed z-40 flex flex-col gap-3 items-end md:hidden"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 80px)',
            right: '20px',
          }}
        >
          {quickActions.map(({ id, label, icon: Icon, color }, index) => (
            <div
              key={id}
              className="flex items-center gap-3"
              style={{
                animation: `fadeIn 0.15s ease-out ${index * 0.05}s both`,
              }}
            >
              <span
                className="px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg"
                style={{
                  background: 'var(--color-surface-solid)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {label}
              </span>
              <button
                onClick={() => {
                  onNavigate(id);
                  setIsExpanded(false);
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
                style={{
                  backgroundColor: color,
                  color: 'white',
                }}
                aria-label={`สร้าง${label}`}
                title={`สร้าง${label}`}
              >
                <Icon size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed z-40 md:hidden w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)',
          right: '20px',
          background: 'var(--gradient-brand)',
          color: 'white',
          boxShadow: '0 4px 20px rgba(234, 88, 12, 0.35), 0 0 40px rgba(234, 88, 12, 0.15)',
        }}
        aria-label={isExpanded ? 'ปิดเมนูสร้างเอกสาร' : 'เปิดเมนูสร้างเอกสาร'}
        title={isExpanded ? 'ปิดเมนูสร้างเอกสาร' : 'เปิดเมนูสร้างเอกสาร'}
      >
        {isExpanded ? (
          <X size={24} style={{ transition: 'transform 0.3s', transform: 'rotate(90deg)' }} />
        ) : (
          <Plus size={24} style={{ transition: 'transform 0.3s' }} />
        )}
      </button>
    </>
  );
}
