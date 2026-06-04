export type DocumentTypeId = 'taxinvoice' | 'receipt' | 'cashbill' | 'delivery';

export interface DocumentTypeMeta {
  id: DocumentTypeId;
  label: string;
  prefix: 'INV' | 'RCP' | 'CSB' | 'DLV';
  color: string;
  badgeClass: string;
}

export const DOCUMENT_TYPE_META: Record<DocumentTypeId, DocumentTypeMeta> = {
  taxinvoice: {
    id: 'taxinvoice',
    label: 'ใบกำกับภาษี',
    prefix: 'INV',
    color: 'var(--doc-taxinvoice)',
    badgeClass: 'badge-doc-taxinvoice',
  },
  receipt: {
    id: 'receipt',
    label: 'ใบเสร็จรับเงิน',
    prefix: 'RCP',
    color: 'var(--doc-receipt)',
    badgeClass: 'badge-doc-receipt',
  },
  cashbill: {
    id: 'cashbill',
    label: 'บิลเงินสด',
    prefix: 'CSB',
    color: 'var(--doc-cashbill)',
    badgeClass: 'badge-doc-cashbill',
  },
  delivery: {
    id: 'delivery',
    label: 'ใบส่งของ',
    prefix: 'DLV',
    color: 'var(--doc-delivery)',
    badgeClass: 'badge-doc-delivery',
  },
};

const PREFIX_TO_TYPE: Record<string, DocumentTypeId> = {
  INV: 'taxinvoice',
  RCP: 'receipt',
  CSB: 'cashbill',
  DLV: 'delivery',
};

export function getDocumentTypeMeta(type?: string): DocumentTypeMeta {
  const fallback = DOCUMENT_TYPE_META.taxinvoice;
  if (!type) return fallback;

  const normalized = type.toLowerCase();
  if (normalized in DOCUMENT_TYPE_META) {
    return DOCUMENT_TYPE_META[normalized as DocumentTypeId];
  }

  return fallback;
}

export function getDocumentTypeByNumber(documentNumber: string): DocumentTypeId {
  const prefix = documentNumber.split('-')[0]?.toUpperCase();
  return PREFIX_TO_TYPE[prefix] ?? 'taxinvoice';
}
