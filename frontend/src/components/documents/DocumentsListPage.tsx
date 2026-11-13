import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import {
  Plus, Printer, Search, FileText, Edit, Clock, Share2, FileSpreadsheet,
  FileCode, Download, CheckCircle2, Ban, FileDiff, X
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/errorUtils';
import DocumentHistoryModal from './DocumentHistoryModal';
import ShareDocumentModal from './ShareDocumentModal';

interface DocumentLine {
  id?: string;
  sortOrder?: number;
  productId?: string | null;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  discountAmount?: number;
  lineTotal: number;
}

interface DocumentHeader {
  id: string;
  documentNumber: string;
  documentDate: string;
  customerName: string;
  grandTotal: number;
  status: string;
  deliveryStatus?: string | null;
  vatMode?: string;
  vatRate?: number;
  whtRate?: number;
  lines: DocumentLine[];
}

interface CnDnDraftState {
  sourceDocId: string;
  sourceDocNumber: string;
  customerName: string;
  noteType: 'CreditNote' | 'DebitNote';
  reason: string;
  vatMode: string;
  vatRate: number;
  whtRate: number;
  lines: Array<{
    productId?: string | null;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountAmount: number;
  }>;
}

const DELIVERY_STATUS_OPTIONS = ['รอส่ง', 'กำลังจัดส่ง', 'ส่งสำเร็จแล้ว'] as const;

export default function DocumentsListPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [historyDoc, setHistoryDoc] = useState<{ id: string; num: string } | null>(null);
  const [shareDoc, setShareDoc] = useState<{ id: string; num: string } | null>(null);
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [cnDnDraft, setCnDnDraft] = useState<CnDnDraftState | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SystemAdmin';

  const titles: Record<string, string> = {
    taxinvoice: 'ใบกำกับภาษี',
    receipt: 'ใบเสร็จรับเงิน',
    cashbill: 'บิลเงินสด',
    delivery: 'ใบส่งของ',
    quotation: 'ใบเสนอราคา',
    creditnote: 'ใบลดหนี้',
    debitnote: 'ใบเพิ่มหนี้',
  };

  const title = titles[type || ''] || 'เอกสาร';

  const getEndpoint = useCallback((t: string) => {
    switch (t) {
      case 'receipt': return '/receipts';
      case 'cashbill': return '/cashbills';
      case 'delivery': return '/deliveries';
      case 'quotation': return '/quotations';
      case 'taxinvoice': return '/tax-invoices';
      case 'creditnote': return '/credit-notes';
      case 'debitnote': return '/debit-notes';
      default: return '/documents';
    }
  }, []);

  const loadDocuments = useCallback(async (searchQuery = ''): Promise<DocumentHeader[]> => {
    const res = await apiClient.get(`${getEndpoint(type || '')}?search=${encodeURIComponent(searchQuery)}`);
    return (res.data.data?.items || []) as DocumentHeader[];
  }, [getEndpoint, type]);

  const fetchDocuments = useCallback(async (searchQuery = '') => {
    try {
      setLoading(true);
      const items = await loadDocuments(searchQuery);
      setDocuments(items);
    } catch (error) {
      console.error('Failed to fetch documents', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [loadDocuments]);

  useEffect(() => {
    let active = true;
    loadDocuments()
      .then((items) => {
        if (active) setDocuments(items);
      })
      .catch((error) => {
        console.error('Failed to fetch documents', error);
        if (active) setDocuments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDocuments]);

  const handleMarkAsPaid = async (docId: string, docNumber: string) => {
    if (!window.confirm(`ยืนยันบันทึกการรับชำระเงินสำหรับ ${docNumber} หรือไม่?`)) return;
    try {
      await apiClient.patch(`${getEndpoint(type || '')}/${docId}/mark-paid`);
      await fetchDocuments(search);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถบันทึกการชำระเงินได้'));
    }
  };

  const handleDeliveryStatusChange = async (docId: string, nextStatus: string) => {
    try {
      await apiClient.patch(`/deliveries/${docId}/delivery-status`, JSON.stringify(nextStatus), {
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchDocuments(search);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถอัปเดตสถานะจัดส่งได้'));
    }
  };

  const handleOpenCreditDebitModal = async (docId: string) => {
    try {
      const res = await apiClient.get(`/documents/${docId}`);
      const detail = res.data?.data as DocumentHeader | undefined;
      if (!detail) return;
      setCnDnDraft({
        sourceDocId: detail.id,
        sourceDocNumber: detail.documentNumber,
        customerName: detail.customerName || '-',
        noteType: 'CreditNote',
        reason: 'ปรับลดราคาสินค้า / รับคืนสินค้าบางส่วน',
        vatMode: detail.vatMode || 'Exclusive',
        vatRate: Number(detail.vatRate ?? 7),
        whtRate: Number(detail.whtRate ?? 0),
        lines: (detail.lines || []).map((line) => ({
          productId: line.productId ?? null,
          description: line.description,
          quantity: Number(line.quantity ?? 1),
          unit: line.unit || 'รายการ',
          unitPrice: Number(line.unitPrice ?? line.lineTotal ?? 0),
          discountAmount: Number(line.discountAmount ?? 0),
        })),
      });
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถโหลดรายละเอียดเอกสารต้นฉบับได้'));
    }
  };

  const handleSubmitCreditDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnDnDraft) return;
    const trimmedReason = cnDnDraft.reason.trim();
    if (!trimmedReason) {
      alert('กรุณาระบุเหตุผลการออกเอกสาร');
      return;
    }

    const validLines = cnDnDraft.lines
      .filter((l) => l.description.trim() && l.quantity > 0 && l.unitPrice >= 0)
      .map((l, idx) => ({
        sortOrder: idx + 1,
        productId: l.productId ?? null,
        description: l.description.trim(),
        quantity: l.quantity,
        unit: l.unit || 'รายการ',
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        lineTotal: Math.max(0, l.quantity * l.unitPrice - l.discountAmount),
      }));

    if (validLines.length === 0) {
      alert('กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    const endpoint = cnDnDraft.noteType === 'CreditNote'
      ? '/credit-notes/credit-debit-note'
      : '/debit-notes/credit-debit-note';
    const adjustmentAmount = validLines.reduce((sum, l) => sum + l.lineTotal, 0);

    try {
      setIsCreatingNote(true);
      const res = await apiClient.post(endpoint, {
        noteType: cnDnDraft.noteType,
        sourceDocumentId: cnDnDraft.sourceDocId,
        documentDate: new Date().toISOString(),
        reason: trimmedReason,
        adjustmentAmount,
        vatMode: cnDnDraft.vatMode,
        vatRate: cnDnDraft.vatRate,
        whtRate: cnDnDraft.whtRate,
        lines: validLines,
      });
      const created = res.data?.data as DocumentHeader | undefined;
      const targetRoute = cnDnDraft.noteType === 'CreditNote' ? '/documents/creditnote' : '/documents/debitnote';
      setCnDnDraft(null);
      if (created?.id) {
        alert(`ออกเอกสาร ${created.documentNumber} สำเร็จ`);
      }
      navigate(targetRoute);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถออกใบลดหนี้/เพิ่มหนี้ได้'));
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleCancelDocument = async (docId: string, docNumber: string) => {
    const reason = window.prompt(`ระบุเหตุผลในการยกเลิกเอกสาร ${docNumber}:`, 'ข้อมูลไม่ถูกต้อง');
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      alert('กรุณาระบุเหตุผลการยกเลิกเอกสาร');
      return;
    }
    try {
      await apiClient.delete(`${getEndpoint(type || '')}/${docId}`, {
        data: { reason: trimmedReason },
      });
      await fetchDocuments(search);
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'ไม่สามารถยกเลิกเอกสารได้'));
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    void fetchDocuments(search);
  };

  const handleExportTaxExcel = async () => {
    try {
      const res = await apiClient.get(`/reports/tax/export?year=${reportYear}&month=${reportMonth}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `รายงานภาษีขาย_${reportYear}_${String(reportMonth).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถส่งออกรายงานภาษีขายได้');
    }
  };

  const handleDownloadETaxXml = async (docId: string, docNumber: string) => {
    try {
      const res = await apiClient.get(`/tax-invoices/${docId}/e-tax-xml`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ETAX-${docNumber || docId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถดาวน์โหลดไฟล์ e-Tax XML ได้');
    }
  };

  const handleDownloadPdf = async (docId: string, docNumber: string) => {
    try {
      const res = await apiClient.get(`/documents/${docId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNumber || docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(`/print/${docId}`, '_blank');
    }
  };

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">ร่าง</span>;
      case 'issued': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">ออกแล้ว</span>;
      case 'sent': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">ส่งแล้ว</span>;
      case 'viewed': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">เปิดอ่านแล้ว</span>;
      case 'paid': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">ชำระแล้ว</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">ยกเลิก</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const canIssueCreditDebit = type === 'taxinvoice' || type === 'receipt' || type === 'cashbill';
  const colCount = type === 'delivery' ? 7 : 6;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">รายการ{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            จัดการและดูประวัติ{title}ทั้งหมดของคุณ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {type === 'taxinvoice' && (
            <div className="flex items-center gap-2">
              <select
                aria-label="เลือกเดือนรายงานภาษีขาย"
                className="input-field py-2 px-3 text-sm"
                value={reportMonth}
                onChange={(e) => setReportMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    เดือน {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="เลือกปีรายงานภาษีขาย"
                className="input-field py-2 px-3 text-sm"
                value={reportYear}
                onChange={(e) => setReportYear(Number(e.target.value))}
              >
                {[reportYear - 1, reportYear, reportYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y + 543} ({y})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportTaxExcel}
                className="btn btn-secondary whitespace-nowrap flex items-center gap-1.5"
                title="ดาวน์โหลดรายงานภาษีขายประจำเดือน (Excel)"
              >
                <FileSpreadsheet size={16} /> รายงานภาษีขาย (Excel)
              </button>
            </div>
          )}
          <Link to={`/documents/${type}/create`} className="btn btn-primary whitespace-nowrap">
            <Plus size={18} className="mr-1" /> สร้าง{title}
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่เอกสาร หรือชื่อลูกค้า..."
            className="input-field pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm text-left">
            <thead>
              <tr>
                <th className="whitespace-nowrap">วันที่</th>
                <th className="whitespace-nowrap">เลขที่เอกสาร</th>
                <th className="whitespace-nowrap">ลูกค้า</th>
                <th className="text-right whitespace-nowrap">ยอดรวม (บาท)</th>
                <th className="text-center whitespace-nowrap">สถานะ</th>
                {type === 'delivery' && <th className="text-center whitespace-nowrap">สถานะจัดส่ง</th>}
                <th className="text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2"></div>
                    <p>กำลังโหลดข้อมูล...</p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <FileText size={32} className="mx-auto mb-3 opacity-20" />
                    <p>ไม่พบรายการ{title}</p>
                    {search && <p className="text-xs mt-1 opacity-70">ลองค้นหาด้วยคำอื่น</p>}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[var(--color-bg-secondary)]/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-[var(--color-text)]">
                      {new Date(doc.documentDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-[var(--color-primary)]">
                      {doc.documentNumber}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text)]">
                      <div className="font-medium truncate max-w-[200px]">{doc.customerName || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold tabular-nums text-[var(--color-text)]">
                      {formatNumber(doc.grandTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(doc.status)}
                    </td>
                    {type === 'delivery' && (
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {doc.status?.toLowerCase() === 'cancelled' ? (
                          <span className="text-xs text-[var(--color-text-muted)]">-</span>
                        ) : (
                          <select
                            aria-label={`อัปเดตสถานะจัดส่งสำหรับ ${doc.documentNumber}`}
                            className="input-field py-1 px-2 text-xs"
                            value={doc.deliveryStatus || 'รอส่ง'}
                            onChange={(e) => void handleDeliveryStatusChange(doc.id, e.target.value)}
                          >
                            {DELIVERY_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            {doc.deliveryStatus && !DELIVERY_STATUS_OPTIONS.includes(doc.deliveryStatus as typeof DELIVERY_STATUS_OPTIONS[number]) && (
                              <option value={doc.deliveryStatus}>{doc.deliveryStatus}</option>
                            )}
                          </select>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {(isAdmin || doc.status === 'Draft') && (
                          <button
                            onClick={() => window.open(`/documents/${type || 'receipt'}/edit/${doc.id}`, '_self')}
                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
                            title="แก้ไข"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {(type === 'taxinvoice' || type === 'debitnote') && ['issued', 'sent', 'viewed', 'overdue'].includes(doc.status?.toLowerCase()) && (
                          <button
                            onClick={() => void handleMarkAsPaid(doc.id, doc.documentNumber)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="บันทึกชำระเงินแล้ว"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {canIssueCreditDebit && doc.status?.toLowerCase() !== 'draft' && doc.status?.toLowerCase() !== 'cancelled' && (
                          <button
                            onClick={() => void handleOpenCreditDebitModal(doc.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="ออกใบลดหนี้ / ใบเพิ่มหนี้"
                          >
                            <FileDiff size={16} />
                          </button>
                        )}
                        {type === 'taxinvoice' && doc.status?.toLowerCase() !== 'draft' && (
                          <button
                            onClick={() => handleDownloadETaxXml(doc.id, doc.documentNumber)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                            title="ดาวน์โหลด e-Tax XML"
                          >
                            <FileCode size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPdf(doc.id, doc.documentNumber)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="ดาวน์โหลด PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => setShareDoc({ id: doc.id, num: doc.documentNumber })}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="แชร์เอกสาร"
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          onClick={() => setHistoryDoc({ id: doc.id, num: doc.documentNumber })}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                          title="ประวัติการแก้ไข"
                        >
                          <Clock size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="ดู/พิมพ์"
                        >
                          <Printer size={16} />
                        </button>
                        {(isAdmin || doc.status?.toLowerCase() === 'draft') && doc.status?.toLowerCase() !== 'cancelled' && (
                          <button
                            onClick={() => void handleCancelDocument(doc.id, doc.documentNumber)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="ยกเลิกเอกสาร"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {historyDoc && (
        <DocumentHistoryModal
          documentId={historyDoc.id}
          documentNumber={historyDoc.num}
          onClose={() => setHistoryDoc(null)}
        />
      )}
      {shareDoc && (
        <ShareDocumentModal
          documentId={shareDoc.id}
          documentNumber={shareDoc.num}
          onClose={() => setShareDoc(null)}
        />
      )}
      {cnDnDraft && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="rounded-2xl shadow-xl w-full max-w-2xl border overflow-hidden bg-[var(--color-surface-solid)] text-[var(--color-text)] border-[var(--color-border)]">
            <div className="layout-entity-modal-head flex items-center justify-between border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-lg">ออกใบลดหนี้ / ใบเพิ่มหนี้</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  อ้างอิงเอกสาร {cnDnDraft.sourceDocNumber} — {cnDnDraft.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCnDnDraft(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitCreditDebitNote} className="form-modal-content form-stack-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">ประเภทเอกสาร *</label>
                  <select
                    className="input-field"
                    value={cnDnDraft.noteType}
                    onChange={(e) => {
                      const noteType = e.target.value as 'CreditNote' | 'DebitNote';
                      setCnDnDraft((prev) => prev ? {
                        ...prev,
                        noteType,
                        reason: noteType === 'CreditNote' ? 'ปรับลดราคาสินค้า / รับคืนสินค้าบางส่วน' : 'คิดค่าสินค้า/บริการเพิ่มเติม',
                      } : null);
                    }}
                  >
                    <option value="CreditNote">ใบลดหนี้ (Credit Note - CN)</option>
                    <option value="DebitNote">ใบเพิ่มหนี้ (Debit Note - DN)</option>
                  </select>
                </div>
                <div>
                  <label className="layout-form-label-sm block text-sm font-medium">เหตุผลในการออกเอกสาร *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={cnDnDraft.reason}
                    onChange={(e) => setCnDnDraft((prev) => prev ? { ...prev, reason: e.target.value } : null)}
                    placeholder="ระบุเหตุผล"
                  />
                </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                <table className="data-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th className="w-24 text-right">จำนวน</th>
                      <th className="w-28 text-right">ราคา/หน่วย</th>
                      <th className="w-28 text-right">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cnDnDraft.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="input-field py-1 px-2 text-xs"
                            value={line.description}
                            onChange={(e) => setCnDnDraft((prev) => prev ? {
                              ...prev,
                              lines: prev.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l),
                            } : null)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="input-field py-1 px-2 text-xs text-right"
                            value={line.quantity}
                            onChange={(e) => setCnDnDraft((prev) => prev ? {
                              ...prev,
                              lines: prev.lines.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) || 0 } : l),
                            } : null)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="input-field py-1 px-2 text-xs text-right"
                            value={line.unitPrice}
                            onChange={(e) => setCnDnDraft((prev) => prev ? {
                              ...prev,
                              lines: prev.lines.map((l, i) => i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l),
                            } : null)}
                          />
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatNumber(Math.max(0, line.quantity * line.unitPrice - line.discountAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-modal-actions">
                <button type="button" onClick={() => setCnDnDraft(null)} className="btn btn-ghost">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isCreatingNote} className="btn btn-primary">
                  {isCreatingNote
                    ? 'กำลังบันทึก...'
                    : cnDnDraft.noteType === 'CreditNote' ? 'บันทึกใบลดหนี้ (CN)' : 'บันทึกใบเพิ่มหนี้ (DN)'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
