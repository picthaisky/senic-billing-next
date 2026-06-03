import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft, Download } from 'lucide-react';
import A4DocumentTemplate, { type DocumentData } from '../components/forms/A4DocumentTemplate';

// Mock data generator for the demo
const getMockData = (id: string): DocumentData => {
  return {
    documentNumber: `INV-202606-${id.padStart(4, '0')}`,
    documentDate: '03/06/2569',
    documentTypeLabel: 'ใบเสร็จรับเงิน / ใบกำกับภาษี',
    customerName: 'บริษัท แคนเซอร์อลิอันซ์ จำกัด (สำนักงานใหญ่)',
    customerAddress: '529 หมู่ 3 ตำบลหนองขาม อำเภอศรีราชา จังหวัดชลบุรี 20110',
    customerPhone: '033-046-333',
    customerBranch: 'สำนักงานใหญ่',
    customerTaxId: '0205561001360',
    reference: '',
    saleType: '',
    items: [
      {
        no: 1,
        description: 'ค่าบริการเปิดเครื่องซ่อมตรวจเช็คและทดสอบระบบต่างๆ ทำชุดระบายความร้อน ติดตั้งระบบปฏิบัติการ และตั้งค่าการใช้งานอื่นๆ และขนส่ง จำนวน 3 เครื่อง',
        quantity: 3,
        unit: 'ตัว',
        unitPrice: 900,
        discount: 0,
        total: 2700,
      },
      {
        no: 2,
        description: 'ค่าอุปกรณ์พร้อมเปลี่ยนถ่านBios 3 เครื่อง',
        quantity: 3,
        unit: 'ตัว',
        unitPrice: 200,
        discount: 0,
        total: 600,
      }
    ],
    remark: '',
    discountTotal: 0,
    subTotal: 3300,
    vatAmount: 0,
    grandTotal: 3300,
  };
};

export default function DocumentPrintView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DocumentData | null>(null);

  useEffect(() => {
    // In a real app, fetch data from API using the ID
    // apiClient.get(`/document/${id}`).then(...)
    
    // Using mock data for now
    if (id) {
      setData(getMockData(id));
    }
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
        
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn btn-secondary">
            <Download size={18} /> ออกเป็น PDF
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer size={18} /> สั่งพิมพ์
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
