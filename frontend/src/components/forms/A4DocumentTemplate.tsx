import { bahtText } from '../../utils/bahtText';

export interface DocumentData {
  documentNumber: string;
  documentDate: string;
  documentTypeLabel?: string; // e.g. "ใบเสร็จรับเงิน / ใบกำกับภาษี"
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerFax?: string;
  customerBranch: string;
  customerTaxId: string;
  reference?: string;
  saleType?: string;
  items: Array<{
    no: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  remark: string;
  discountTotal: number;
  subTotal: number;
  vatAmount: number;
  grandTotal: number;
}

interface Props {
  data: DocumentData;
}

export default function A4DocumentTemplate({ data }: Props) {
  const formatNum = (num: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  return (
    <div className="a4-page font-sarabun text-sm bg-white text-black relative flex flex-col" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      
      {/* ──────────────── HEADER ──────────────── */}
      <div className="flex justify-between items-start mb-4">
        {/* Company Info */}
        <div className="w-1/2">
          <h1 className="text-2xl font-bold mb-2">ร้าน ซีนิค โซลูชั่น</h1>
          <p className="leading-tight">
            392/39 หมู่10 ต.บางพระ<br/>
            อ.ศรีราชา จ.ชลบุรี 20110<br/>
            087-593-7988, 062-723-6622
          </p>
        </div>
        
        {/* Right Info */}
        <div className="w-1/2 text-right flex flex-col items-end">
          <p className="mb-2 text-right">Page 1 of 1</p>
          <table className="text-left w-[300px] mb-2 text-sm">
            <tbody>
              <tr>
                <td className="font-semibold py-0.5 w-[140px]">สาขาที่ออกเอกสาร</td>
                <td>สำนักงานใหญ่</td>
              </tr>
              <tr>
                <td className="font-semibold py-0.5">เลขประจำตัวผู้เสียภาษี</td>
                <td>1250200133469</td>
              </tr>
            </tbody>
          </table>
          <p className="font-bold text-base mt-1">เอกสารออกเป็นชุด</p>
        </div>
      </div>

      {/* Document Title Banner */}
      <div className="bg-[#fdfcdc] text-center py-2 mb-4 border border-[#e5e7eb] font-bold text-lg avoid-break">
        {data.documentTypeLabel || 'ใบเสร็จรับเงิน / ใบกำกับภาษี'}
      </div>

      {/* ──────────────── CUSTOMER & DOC INFO ──────────────── */}
      <div className="flex w-full mb-4 border border-black avoid-break">
        
        {/* Customer Box (Left) */}
        <div className="w-2/3 p-3 border-r border-black flex flex-col justify-between">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-bold w-[70px] align-top py-1">ชื่อลูกค้า</td>
                <td className="align-top py-1">{data.customerName}</td>
              </tr>
              <tr>
                <td className="font-bold align-top py-1">ที่อยู่</td>
                <td className="align-top py-1">{data.customerAddress}</td>
              </tr>
              <tr>
                <td className="font-bold align-top py-1">โทรศัพท์</td>
                <td className="align-top py-1">{data.customerPhone}</td>
              </tr>
              <tr>
                <td className="font-bold align-top py-1">แฟกซ์</td>
                <td className="align-top py-1">{data.customerFax || '-'}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex gap-4 mt-2 font-bold text-sm">
            <span>สาขา <span className="font-normal">{data.customerBranch}</span></span>
            <span>เลขประจำตัวผู้เสียภาษี <span className="font-normal">{data.customerTaxId}</span></span>
          </div>
        </div>

        {/* Doc Info Box (Right) */}
        <div className="w-1/3 p-3">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-bold py-1.5 w-[80px]">เลขที่เอกสาร</td>
                <td className="py-1.5">{data.documentNumber}</td>
              </tr>
              <tr>
                <td className="font-bold py-1.5">วันที่</td>
                <td className="py-1.5">{data.documentDate}</td>
              </tr>
              <tr>
                <td className="font-bold py-1.5">อ้างถึง</td>
                <td className="py-1.5">{data.reference || '-'}</td>
              </tr>
              <tr>
                <td className="font-bold py-1.5">ชนิดการขาย</td>
                <td className="py-1.5">{data.saleType || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────── ITEMS TABLE ──────────────── */}
      <div className="flex-1 min-h-[300px] border-b border-black mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-t border-b border-black">
              <th className="py-2 px-1 text-center font-bold w-[40px]">No.</th>
              <th className="py-2 px-2 text-left font-bold">รายการ</th>
              <th className="py-2 px-1 text-right font-bold w-[70px]">จำนวน</th>
              <th className="py-2 px-1 text-left font-bold w-[60px] ml-2">หน่วย</th>
              <th className="py-2 px-1 text-right font-bold w-[80px]">ราคา</th>
              <th className="py-2 px-1 text-right font-bold w-[70px]">ส่วนลด</th>
              <th className="py-2 px-1 text-right font-bold w-[100px]">รวมเงิน</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="avoid-break align-top">
                <td className="py-1.5 px-1 text-center">{item.no}</td>
                <td className="py-1.5 px-2">{item.description}</td>
                <td className="py-1.5 px-1 text-right">{formatNum(item.quantity)}</td>
                <td className="py-1.5 px-1 pl-3 text-left">{item.unit}</td>
                <td className="py-1.5 px-1 text-right">{formatNum(item.unitPrice)}</td>
                <td className="py-1.5 px-1 text-right">{item.discount > 0 ? formatNum(item.discount) : '0.00'}</td>
                <td className="py-1.5 px-1 text-right">{formatNum(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ──────────────── FOOTER ──────────────── */}
      <div className="flex w-full border border-black avoid-break mb-8">
        
        {/* Left Footer (Remark & Baht Text) */}
        <div className="w-2/3 p-3 flex flex-col justify-between border-r border-black">
          <div>
            <p className="font-bold mb-1">หมายเหตุ</p>
            <p className="text-xs">{data.remark}</p>
          </div>
          
          <div className="mt-4">
            <div className="bg-[#fdfcdc] text-center py-2 font-bold mb-3">
              {bahtText(data.grandTotal)}
            </div>
            <div className="text-[11px] leading-tight space-y-1">
              <p>* ได้รับสินค้าตามรายการข้างต้นในสภาพที่เรียบร้อยจำนวนสินค้าและราคาถูกต้องแล้ว</p>
              <p>* เอกสารฉบับนี้จะสมบูรณ์ต่อเมื่อได้เรียกเก็บเงินจากลูกค้าหรือเช็คผ่านธนาคารเรียบร้อยแล้ว</p>
            </div>
          </div>
        </div>

        {/* Right Footer (Totals) */}
        <div className="w-1/3">
          <table className="w-full h-full text-sm">
            <tbody>
              <tr className="border-b border-[#e5e7eb]">
                <td className="py-2 px-3 font-bold">ส่วนลดการค้า</td>
                <td className="py-2 px-3 text-right">{formatNum(data.discountTotal)}</td>
              </tr>
              <tr className="border-b border-[#e5e7eb]">
                <td className="py-2 px-3 font-bold">มูลค่าสินค้า</td>
                <td className="py-2 px-3 text-right">{formatNum(data.subTotal)}</td>
              </tr>
              <tr className="border-b border-[#e5e7eb]">
                <td className="py-2 px-3 font-bold">ภาษีมูลค่าเพิ่ม</td>
                <td className="py-2 px-3 text-right">{formatNum(data.vatAmount)}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-base">รวมทั้งสิ้น</td>
                <td className="py-2 px-3 text-right font-bold text-base">{formatNum(data.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────── SIGNATURES ──────────────── */}
      <div className="flex justify-between w-full mt-4 avoid-break text-center text-sm pt-4">
        <div className="w-1/3">
          <p className="font-bold mb-8 text-left pl-4">ผู้อนุมัติ</p>
          <div className="border-b border-black w-[80%] mx-auto mb-2"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
        <div className="w-1/3">
          <p className="font-bold mb-8 text-left pl-4">ผู้รับเงิน</p>
          <div className="border-b border-black w-[80%] mx-auto mb-2"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
        <div className="w-1/3">
          <p className="font-bold mb-8 text-left pl-4">ผู้รับสินค้า</p>
          <div className="border-b border-black w-[80%] mx-auto mb-2"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
      </div>

    </div>
  );
}
