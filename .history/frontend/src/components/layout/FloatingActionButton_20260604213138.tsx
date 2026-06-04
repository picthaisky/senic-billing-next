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
          className="layout-fab-backdrop fixed inset-0 z-30 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Quick Action Items */}
      {isExpanded && (
        <div className="layout-fab-actions fixed z-40 flex flex-col gap-3 items-end md:hidden">
          {quickActions.map(({ id, label, icon: Icon, color }, index) => (
            <div
              key={id}
              className={`layout-fab-action-row flex items-center gap-3 delay-${Math.min(index + 1, 5)}`}
            >
              <span className="layout-fab-action-label px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg">
                {label}
              </span>
              <button
                onClick={() => {
                  onNavigate(id);
                  setIsExpanded(false);
                }}
                className="layout-fab-action-btn haptic-tap w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: color }}
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
        className={`layout-fab-main haptic-tap fixed z-40 md:hidden w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${isExpanded ? 'is-expanded' : ''}`}
        aria-label={isExpanded ? 'ปิดเมนูสร้างเอกสาร' : 'เปิดเมนูสร้างเอกสาร'}
        title={isExpanded ? 'ปิดเมนูสร้างเอกสาร' : 'เปิดเมนูสร้างเอกสาร'}
      >
        {isExpanded ? (
          <X size={24} className="layout-fab-main-icon is-rotated" />
        ) : (
          <Plus size={24} className="layout-fab-main-icon" />
        )}
      </button>
    </>
  );
}
