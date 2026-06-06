import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft, Download } from 'lucide-react';
import A4DocumentTemplate, { type DocumentData } from '../components/forms/A4DocumentTemplate';
import { apiClient } from '../services/apiClient';

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
  const [data, setData] = useState<DocumentData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return;
        
        const docRes = await apiClient.get(`/documents/${id}`);
        const tenantRes = await apiClient.get('/tenants/current');
        
        const doc = docRes.data?.data || docRes.data;
        const tenant = tenantRes.data?.data || tenantRes.data;

        if (doc) {
          const mappedData: DocumentData = {
            documentNumber: doc.documentNumber || '',
            documentDate: doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('th-TH') : '',
            documentTypeLabel: getDocumentTypeLabel(doc.documentType),
            tenantName: tenant?.companyName,
            tenantAddress: tenant?.address,
            tenantPhone: tenant?.phone,
            tenantTaxId: tenant?.taxId,
            tenantBranch: tenant?.branchName,
            customerName: doc.customerName || '',
            customerAddress: doc.customerAddress || '',
            customerPhone: '', // Not in DTO currently, might need fallback
            customerBranch: 'สำนักงานใหญ่',
            customerTaxId: doc.customerTaxId || '',
            reference: doc.referenceDocumentId ? `อ้างอิง: ${doc.referenceDocumentId}` : '',
            items: (doc.lines || []).map((line: any, idx: number) => ({
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
        }
      } catch (error) {
        console.error('Failed to fetch document print data:', error);
      }
    };
    
    fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (!data) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      
      {/* ──────────────── NON-PRINTABLE TOOLBAR ──────────────── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-sm p-4 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="btn btn-ghost"
        >
          <ChevronLeft size={18} /> กลับ
        </button>
        
        <div className="flex gap-2 items-center">
          <button 
            onClick={async () => {
              try {
                const res = await apiClient.post(`/Payments/${id}/payment-link`);
                const url = res.data?.paymentUrl || res.data?.data?.paymentUrl;
                if (url) {
                  navigator.clipboard.writeText(url);
                  alert('สร้างและคัดลอกลิงก์รับชำระเงินเรียบร้อยแล้ว: \n' + url);
                }
              } catch (error) {
                alert('เกิดข้อผิดพลาดในการสร้างลิงก์');
              }
            }}
            className="btn border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-50)]"
          >
            💳 สร้างลิงก์รับเงิน
          </button>

          <button 
            onClick={async () => {
              try {
                const res = await apiClient.post(`/Document/${id}/convert/TaxInvoice`);
                const newId = res.data?.data?.id || res.data?.id;
                if (newId) {
                  alert('แปลงเป็นใบกำกับภาษีสำเร็จ');
                  navigate(`/print/${newId}`);
                }
              } catch (error) {
                alert('เกิดข้อผิดพลาดในการแปลงเอกสาร');
              }
            }}
            className="btn btn-secondary border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
          >
            🔄 แปลงเป็นใบกำกับภาษี
          </button>
          
          <button onClick={handlePrint} className="btn btn-secondary">
            <Download size={18} /> PDF
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer size={18} /> พิมพ์
          </button>
        </div>
      </div>

      {/* ──────────────── A4 PREVIEW AREA ──────────────── */}
      <div className="flex-1 flex justify-center p-4">
        <A4DocumentTemplate data={data} />
      </div>

    </div>
  );
}
