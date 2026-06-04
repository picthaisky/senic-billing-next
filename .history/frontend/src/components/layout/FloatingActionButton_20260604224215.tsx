import { useState } from 'react';
import { Plus, X, Receipt, Banknote, Truck, FileText, FileCheck } from 'lucide-react';
import { DOCUMENT_TYPE_META, type DocumentTypeId } from '../../utils/documentTypeMeta';
import { useTranslation } from 'react-i18next';

interface FloatingActionButtonProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface FabAction {
  id: DocumentTypeId;
  label: string;
  icon: React.ElementType;
}

const actionColorClass: Record<DocumentTypeId, string> = {
  receipt: 'layout-fab-action-btn--receipt',
  cashbill: 'layout-fab-action-btn--cashbill',
  delivery: 'layout-fab-action-btn--delivery',
  quotation: 'layout-fab-action-btn--quotation',
  taxinvoice: 'layout-fab-action-btn--taxinvoice',
};

export default function FloatingActionButton({ currentPage, onNavigate }: FloatingActionButtonProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const quickActions: FabAction[] = [
    { id: 'receipt', label: t('docType.receipt', { defaultValue: DOCUMENT_TYPE_META.receipt.label }), icon: Receipt },
    { id: 'cashbill', label: t('docType.cashbill', { defaultValue: DOCUMENT_TYPE_META.cashbill.label }), icon: Banknote },
    { id: 'delivery', label: t('docType.delivery', { defaultValue: DOCUMENT_TYPE_META.delivery.label }), icon: Truck },
    { id: 'quotation', label: t('docType.quotation', { defaultValue: DOCUMENT_TYPE_META.quotation.label }), icon: FileText },
    { id: 'taxinvoice', label: t('docType.taxinvoice', { defaultValue: DOCUMENT_TYPE_META.taxinvoice.label }), icon: FileCheck },
  ];

  // Hide FAB on document form pages (user is already creating a doc)
  const hiddenPages = ['receipt', 'cashbill', 'delivery', 'quotation', 'taxinvoice', 'settings', 'profile'];
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
          {quickActions.map(({ id, label, icon: Icon }, index) => (
            <div
              key={id}
              className={`layout-fab-action-row flex items-center gap-3 delay-${Math.min(index + 1, 5)}`}
            >
              <span className="layout-fab-action-label layout-fab-action-label-pad rounded-lg text-sm font-medium shadow-lg">
                {label}
              </span>
              <button
                onClick={() => {
                  onNavigate(id);
                  setIsExpanded(false);
                }}
                className={`layout-fab-action-btn ${actionColorClass[id]} haptic-tap w-12 h-12 rounded-full flex items-center justify-center shadow-lg`}
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
