export type DocumentTypeId = 'taxinvoice' | 'receipt' | 'cashbill' | 'delivery' | 'quotation' | 'creditnote' | 'debitnote';

export interface DocumentTypeMeta {
  id: DocumentTypeId;
  label: string;
  prefix: 'INV' | 'RCP' | 'CSB' | 'DLV' | 'QUO' | 'CN' | 'DN';
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
  quotation: {
    id: 'quotation',
    label: 'ใบเสนอราคา',
    prefix: 'QUO',
    color: 'var(--doc-quotation)',
    badgeClass: 'badge-doc-quotation',
  },
  creditnote: {
    id: 'creditnote',
    label: 'ใบลดหนี้',
    prefix: 'CN',
    color: 'var(--doc-creditnote)',
    badgeClass: 'badge-doc-creditnote',
  },
  debitnote: {
    id: 'debitnote',
    label: 'ใบเพิ่มหนี้',
    prefix: 'DN',
    color: 'var(--doc-debitnote)',
    badgeClass: 'badge-doc-debitnote',
  },
};

const PREFIX_TO_TYPE: Record<string, DocumentTypeId> = {
  INV: 'taxinvoice',
  RCP: 'receipt',
  CSB: 'cashbill',
  DLV: 'delivery',
  QUO: 'quotation',
  CN: 'creditnote',
  DN: 'debitnote',
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
