import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft, Download, CreditCard, RefreshCw, FileCode, QrCode } from 'lucide-react';
import A4DocumentTemplate, { type DocumentData } from '../components/forms/A4DocumentTemplate';
import PaymentModal from '../components/payments/PaymentModal';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/useAuthStore';

const getDocumentTypeLabel = (type?: string) => {
  switch (type) {
    case 'Receipt': return 'ใบเสร็จรับเงิน';
    case 'CashBill': return 'บิลเงินสด';
    case 'DeliveryNote': return 'ใบส่งของ';
    case 'TaxInvoice': return 'ใบกำกับภาษี';
    case 'Quotation': return 'ใบเสนอราคา';
    case 'CreditNote': return 'ใบลดหนี้';
    case 'DebitNote': return 'ใบเพิ่มหนี้';
    case 'PurchaseOrder': return 'ใบสั่งซื้อ';
    default: return 'ใบแจ้งหนี้ / ใบเสร็จรับเงิน';
  }
};

export default function DocumentPrintView() {
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
  } | null>(null);
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
        });

        const mappedData: DocumentData = {
          documentNumber: doc.documentNumber || '',
          documentDate: doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('th-TH') : '',
          documentTypeLabel: getDocumentTypeLabel(String(doc.documentType)),
          tenantName: payload?.companyName,
          tenantAddress: payload?.address,
          tenantPhone: payload?.phone,
          tenantTaxId: payload?.taxId,
          tenantBranch: payload?.branchName,
          customerName: doc.customerName || '',
          customerAddress: doc.customerAddress || '',
          customerPhone: '',
          customerBranch: doc.customerBranch || 'สำนักงานใหญ่',
          customerTaxId: doc.customerTaxId || '',
          reference: doc.referenceDocumentId ? `อ้างอิง: ${doc.referenceDocumentId}` : '',
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
        setLoadError('ไม่พบข้อมูลเอกสาร');
      }
    } catch (error) {
      console.error('Failed to fetch document print data:', error);
      setLoadError('ไม่พบเอกสาร หรือไม่สามารถโหลดข้อมูลเอกสารได้');
    }
  }, [id]);

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
      const res = await apiClient.get(`/tax-invoices/${id}/e-tax-xml`, { responseType: 'blob' });
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
      alert('ไม่สามารถดาวน์โหลดไฟล์ e-Tax XML ได้ (เอกสารต้องไม่อยู่ในสถานะร่าง)');
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-base font-medium text-red-600">{loadError}</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary flex items-center gap-1.5">
          <ChevronLeft size={16} /> กลับหน้าก่อนหน้า
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-10 text-center">กำลังโหลดเอกสาร...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      
      {/* ──────────────── NON-PRINTABLE TOOLBAR ──────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-sm p-4 flex items-center justify-between flex-wrap gap-2">
        <button 
          onClick={() => navigate(-1)} 
          className="btn btn-ghost flex items-center gap-1"
        >
          <ChevronLeft size={18} /> กลับ
        </button>
        
        <div className="flex gap-2 items-center flex-wrap">
          {rawDoc && rawDoc.status !== 'Paid' && rawDoc.status !== 'Cancelled' && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <QrCode size={16} /> สแกนชำระเงิน (PromptPay)
            </button>
          )}

          {isAuthenticated && (
            <button 
              onClick={async () => {
                try {
                  const res = await apiClient.post(`/payments/${id}/payment-link`);
                  const url = res.data?.paymentUrl || res.data?.data?.paymentUrl;
                  if (url) {
                    navigator.clipboard.writeText(url);
                    alert('สร้างและคัดลอกลิงก์รับชำระเงินเรียบร้อยแล้ว:\n' + url);
                  }
                } catch {
                  alert('เกิดข้อผิดพลาดในการสร้างลิงก์รับชำระเงิน');
                }
              }}
              className="btn border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-50)] flex items-center gap-1.5"
            >
              <CreditCard size={16} /> สร้างลิงก์รับเงิน
            </button>
          )}

          {isAuthenticated && rawDoc?.documentType !== 'TaxInvoice' && (
            <button 
              onClick={async () => {
                try {
                  const res = await apiClient.post(`/documents/${id}/convert`, {
                    targetType: 'TaxInvoice',
                  });
                  const newId = res.data?.data?.id || res.data?.id;
                  if (newId) {
                    alert('แปลงเป็นใบกำกับภาษีสำเร็จ');
                    navigate(`/print/${newId}`);
                  }
                } catch {
                  alert('เกิดข้อผิดพลาดในการแปลงเอกสาร');
                }
              }}
              className="btn btn-secondary border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 flex items-center gap-1.5"
            >
              <RefreshCw size={16} /> แปลงเป็นใบกำกับภาษี
            </button>
          )}

          {isAuthenticated && rawDoc?.documentType === 'TaxInvoice' && rawDoc?.status !== 'Draft' && (
            <button
              onClick={handleDownloadETaxXml}
              className="btn btn-secondary flex items-center gap-1.5"
              title="ดาวน์โหลดไฟล์ ETDA e-Tax Invoice XML"
            >
              <FileCode size={16} /> e-Tax XML
            </button>
          )}
          
          <button onClick={handleDownloadServerPdf} className="btn btn-secondary flex items-center gap-1.5">
            <Download size={18} /> ดาวน์โหลด PDF
          </button>
          <button onClick={handlePrint} className="btn btn-primary flex items-center gap-1.5">
            <Printer size={18} /> พิมพ์
          </button>
        </div>
      </div>

      {/* ──────────────── A4 PREVIEW AREA ──────────────── */}
      <div className="flex-1 flex justify-center p-4">
        <A4DocumentTemplate data={data} />
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
    </div>
  );
}
