import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Printer, ChevronLeft, Download, CreditCard, RefreshCw, FileCode, QrCode, CheckCircle2, PenTool, XCircle, X } from 'lucide-react';
import A4DocumentTemplate, { type DocumentData } from '../components/forms/A4DocumentTemplate';
import PaymentModal from '../components/payments/PaymentModal';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/useAuthStore';

const getDocumentTypeLabel = (type: string | undefined, t: TFunction) => {
  switch (type) {
    case 'Receipt': return t('docType.receipt');
    case 'CashBill': return t('docType.cashbill');
    case 'DeliveryNote': return t('docType.delivery');
    case 'TaxInvoice': return t('docType.taxinvoice');
    case 'Quotation': return t('docType.quotation');
    case 'CreditNote': return t('docType.creditnote');
    case 'DebitNote': return t('docType.debitnote');
    case 'PurchaseOrder': return t('nav.purchaseOrders');
    default: return t('printView.defaultLabel');
  }
};

export default function DocumentPrintView() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [data, setData] = useState<DocumentData | null>(null);
  const [rawDoc, setRawDoc] = useState<{
    id: string;
    documentType: string;
    documentNumber: string;
    status: string;
    grandTotal: number;
    customerApprovalStatus?: string;
    approvedByName?: string | null;
    approvedAt?: string | null;
    customerSignatureText?: string | null;
    customerApprovalComment?: string | null;
  } | null>(null);
  const [approvalMode, setApprovalMode] = useState<'approve' | 'reject' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalBanner, setApprovalBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!id) return;
      setLoadError(null);

      const publicRes = await apiClient.get(`/documents/${id}/public`);
      const payload = publicRes.data?.data || publicRes.data;
      const doc = payload?.document || payload;

      if (doc) {
        setRawDoc({
          id: doc.id,
          documentType: String(doc.documentType || ''),
          documentNumber: doc.documentNumber || '',
          status: String(doc.status || ''),
          grandTotal: Number(doc.grandTotal || 0),
          customerApprovalStatus: doc.customerApprovalStatus ? String(doc.customerApprovalStatus) : 'Pending',
          approvedByName: doc.approvedByName || null,
          approvedAt: doc.approvedAt || null,
          customerSignatureText: doc.customerSignatureText || null,
          customerApprovalComment: doc.customerApprovalComment || null,
        });

        const mappedData: DocumentData = {
          documentNumber: doc.documentNumber || '',
          documentDate: doc.documentDate ? new Date(doc.documentDate).toLocaleDateString(locale) : '',
          documentTypeLabel: getDocumentTypeLabel(String(doc.documentType), t),
          tenantName: payload?.companyName,
          tenantAddress: payload?.address,
          tenantPhone: payload?.phone,
          tenantTaxId: payload?.taxId,
          tenantBranch: payload?.branchName,
          customerName: doc.customerName || '',
          customerAddress: doc.customerAddress || '',
          customerPhone: '',
          customerBranch: doc.customerBranch || t('printView.defaultBranch'),
          customerTaxId: doc.customerTaxId || '',
          reference: doc.referenceDocumentId ? t('printView.referencePrefix', { ref: doc.referenceDocumentId }) : '',
          items: (doc.lines || []).map((line: {
            sortOrder?: number;
            description?: string;
            quantity?: number;
            unit?: string;
            unitPrice?: number;
            discountAmount?: number;
            lineTotal?: number;
          }, idx: number) => ({
            no: line.sortOrder || idx + 1,
            description: line.description || '',
            quantity: line.quantity || 0,
            unit: line.unit || '',
            unitPrice: line.unitPrice || 0,
            discount: line.discountAmount || 0,
            total: line.lineTotal || 0,
          })),
          remark: doc.notes || '',
          discountTotal: doc.discountAmount || 0,
          subTotal: doc.subtotal || 0,
          vatAmount: doc.vatAmount || 0,
          grandTotal: doc.grandTotal || 0,
        };
        setData(mappedData);
      } else {
        setLoadError(t('printView.notFound'));
      }
    } catch (error) {
      console.error('Failed to fetch document print data:', error);
      setLoadError(t('printView.loadError'));
    }
  }, [id, locale, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadServerPdf = async () => {
    if (!id || !rawDoc) return;
    try {
      const res = await apiClient.get(`/documents/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rawDoc.documentNumber || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      window.print();
    }
  };

  const handleDownloadETaxXml = async () => {
    if (!id || !rawDoc) return;
    try {
      const res = await apiClient.get(`/documents/${id}/e-tax-xml`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ETAX-${rawDoc.documentNumber || id}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(t('printView.etaxError'));
    }
  };

  const handleSubmitCustomerApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !approvalMode) return;
    if (!signerName.trim()) {
      setApprovalBanner({ type: 'error', text: t('printView.signerRequired') });
      return;
    }
    if (approvalMode === 'reject' && !approvalComment.trim()) {
      setApprovalBanner({ type: 'error', text: t('printView.rejectReasonRequired') });
      return;
    }

    setSubmittingApproval(true);
    setApprovalBanner(null);
    try {
      if (approvalMode === 'approve') {
        const res = await apiClient.post(`/documents/${id}/public/approve`, {
          signerName: signerName.trim(),
          signatureText: signatureText.trim() || signerName.trim(),
          comment: approvalComment.trim() || null,
        });
        setApprovalBanner({
          type: 'success',
          text: res.data?.message || t('printView.approveSuccess'),
        });
      } else {
        const res = await apiClient.post(`/documents/${id}/public/reject`, {
          signerName: signerName.trim(),
          reason: approvalComment.trim(),
        });
        setApprovalBanner({
          type: 'success',
          text: res.data?.message || t('printView.rejectSuccess'),
        });
      }
      setApprovalMode(null);
      setSignerName('');
      setSignatureText('');
      setApprovalComment('');
      await fetchData();
    } catch {
      setApprovalBanner({ type: 'error', text: t('printView.approvalError') });
    } finally {
      setSubmittingApproval(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-base font-medium text-red-600">{loadError}</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary flex items-center gap-1.5">
          <ChevronLeft size={16} /> {t('printView.goBack')}
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-10 text-center">{t('printView.loading')}</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">

      {/* ──────────────── NON-PRINTABLE TOOLBAR ──────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-sm p-4 flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost flex items-center gap-1"
        >
          <ChevronLeft size={18} /> {t('printView.back')}
        </button>

        <div className="flex gap-2 items-center flex-wrap">
          {rawDoc && rawDoc.status !== 'Paid' && rawDoc.status !== 'Cancelled' && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <QrCode size={16} /> {t('printView.payPromptPay')}
            </button>
          )}

          {isAuthenticated && rawDoc?.status !== 'Cancelled' && (
            <button
              onClick={async () => {
                try {
                  const res = await apiClient.post(`/payments/${id}/payment-link`);
                  const url = res.data?.paymentUrl || res.data?.data?.paymentUrl;
                  if (url) {
                    navigator.clipboard.writeText(url);
                    alert(t('printView.linkCopied', { url }));
                  }
                } catch {
                  alert(t('printView.linkError'));
                }
              }}
              className="btn border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] flex items-center gap-1.5"
            >
              <CreditCard size={16} /> {t('printView.createPayLink')}
            </button>
          )}

          {isAuthenticated && rawDoc && !['TaxInvoice', 'CreditNote', 'DebitNote'].includes(rawDoc.documentType) && rawDoc.status !== 'Cancelled' && (
            <button
              onClick={async () => {
                try {
                  const res = await apiClient.post(`/documents/${id}/convert`, {
                    targetType: 'TaxInvoice',
                  });
                  const newId = res.data?.data?.id || res.data?.id;
                  if (newId) {
                    alert(t('printView.convertSuccess'));
                    navigate(`/print/${newId}`);
                  }
                } catch {
                  alert(t('printView.convertError'));
                }
              }}
              className="btn btn-secondary border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 flex items-center gap-1.5"
            >
              <RefreshCw size={16} /> {t('printView.convertToTaxInvoice')}
            </button>
          )}

          {isAuthenticated && ['TaxInvoice', 'CreditNote', 'DebitNote'].includes(rawDoc?.documentType || '') && !['Draft', 'Cancelled'].includes(rawDoc?.status || '') && (
            <button
              onClick={handleDownloadETaxXml}
              className="btn btn-secondary flex items-center gap-1.5"
              title={t('printView.etaxTitle')}
            >
              <FileCode size={16} /> {t('printView.etaxBtn')}
            </button>
          )}

          <button onClick={handleDownloadServerPdf} className="btn btn-secondary flex items-center gap-1.5">
            <Download size={18} /> {t('printView.downloadPdf')}
          </button>
          <button onClick={handlePrint} className="btn btn-primary flex items-center gap-1.5">
            <Printer size={18} /> {t('printView.printBtn')}
          </button>
        </div>
      </div>

      {/* ──────────────── CUSTOMER ONLINE APPROVAL / E-SIGNATURE BAR ──────────────── */}
      <div className="no-print max-w-[210mm] w-full mx-auto px-4 pt-4 space-y-3">
        {approvalBanner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${
              approvalBanner.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800'
                : 'border-red-500/30 bg-red-50 text-red-800'
            }`}
          >
            <span>{approvalBanner.text}</span>
            <button type="button" onClick={() => setApprovalBanner(null)}><X size={16} /></button>
          </div>
        )}

        {rawDoc && rawDoc.customerApprovalStatus === 'Approved' && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('printView.approvedTitle')}</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {t('printView.approverLabel')} <strong>{rawDoc.approvedByName}</strong> • {t('printView.signatureLabel')} <span className="font-mono">{rawDoc.customerSignatureText || rawDoc.approvedByName}</span>
                  {rawDoc.approvedAt ? ` • ${t('printView.whenLabel', { time: new Date(rawDoc.approvedAt).toLocaleString(locale) })}` : ''}
                </p>
                {rawDoc.customerApprovalComment && (
                  <p className="text-xs text-emerald-700 mt-0.5">{t('printView.commentLabel', { comment: rawDoc.customerApprovalComment })}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {rawDoc && rawDoc.customerApprovalStatus === 'Rejected' && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <XCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('printView.rejectedTitle')}</p>
                <p className="text-xs text-rose-800 mt-0.5">
                  {t('printView.reporterLabel')} <strong>{rawDoc.approvedByName}</strong> • {t('printView.reasonLabel', { reason: rawDoc.customerApprovalComment })}
                </p>
              </div>
            </div>
          </div>
        )}

        {rawDoc && rawDoc.status !== 'Cancelled' && rawDoc.customerApprovalStatus !== 'Approved' && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {t('printView.esignTitle')}
              </p>
              <p className="text-xs text-gray-500">
                {t('printView.esignSubtitle', { docNo: rawDoc.documentNumber })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setApprovalMode('approve');
                  setApprovalComment('');
                }}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <PenTool size={15} /> {t('printView.approveBtn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setApprovalMode('reject');
                  setApprovalComment('');
                }}
                className="btn btn-secondary text-xs text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5"
              >
                <XCircle size={15} /> {t('printView.rejectBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────── A4 PREVIEW AREA ──────────────── */}
      <div className="flex-1 flex justify-center p-4">
        <div className="a4-preview-scroll">
          <A4DocumentTemplate data={data} />
        </div>
      </div>

      {rawDoc && (
        <PaymentModal
          documentId={rawDoc.id}
          documentNumber={rawDoc.documentNumber}
          amount={rawDoc.grandTotal}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            fetchData();
          }}
        />
      )}

      {approvalMode &&
        rawDoc &&
        createPortal(
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 text-gray-900">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-base">
                  {approvalMode === 'approve'
                    ? t('printView.modalApproveTitle', { docNo: rawDoc.documentNumber })
                    : t('printView.modalRejectTitle', { docNo: rawDoc.documentNumber })}
                </h3>
                <button type="button" onClick={() => setApprovalMode(null)}><X size={18} /></button>
              </div>
              <form onSubmit={(e) => void handleSubmitCustomerApproval(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">{t('printView.signerLabel')}</label>
                  <input
                    required
                    type="text"
                    className="input-field"
                    placeholder={t('printView.signerPlaceholder')}
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                  />
                </div>
                {approvalMode === 'approve' && (
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('printView.esignLabel')}</label>
                    <input
                      type="text"
                      className="input-field font-serif italic"
                      placeholder={t('printView.esignPlaceholder')}
                      value={signatureText}
                      onChange={(e) => setSignatureText(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {approvalMode === 'approve' ? t('printView.approveCommentLabel') : t('printView.rejectCommentLabel')}
                  </label>
                  <textarea
                    required={approvalMode === 'reject'}
                    rows={3}
                    className="input-field"
                    placeholder={approvalMode === 'approve' ? t('printView.approveCommentPlaceholder') : t('printView.rejectCommentPlaceholder')}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setApprovalMode(null)} className="btn btn-secondary">{t('printView.cancel')}</button>
                  <button
                    type="submit"
                    disabled={submittingApproval}
                    className={`btn text-white disabled:opacity-50 ${
                      approvalMode === 'approve' ? 'btn-primary' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submittingApproval
                      ? t('printView.submitting')
                      : approvalMode === 'approve'
                        ? t('printView.confirmApprove')
                        : t('printView.confirmReject')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
