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
    <div className="a4-page a4-font-sarabun font-sarabun text-sm bg-white text-black relative flex flex-col">
      
      {/* ──────────────── HEADER ──────────────── */}
      <div className="a4-header-row flex justify-between items-start">
        {/* Company Info */}
        <div className="w-1/2">
          <h1 className="a4-company-title text-2xl font-bold">ร้าน ซีนิค โซลูชั่น</h1>
          <p className="leading-tight">
            392/39 หมู่10 ต.บางพระ<br/>
            อ.ศรีราชา จ.ชลบุรี 20110<br/>
            087-593-7988, 062-723-6622
          </p>
        </div>
        
        {/* Right Info */}
        <div className="w-1/2 text-right flex flex-col items-end">
          <p className="a4-page-label text-right">Page 1 of 1</p>
          <table className="a4-company-meta-table text-left w-[300px] text-sm">
            <tbody>
              <tr>
                <td className="a4-company-meta-label font-semibold w-[140px]">สาขาที่ออกเอกสาร</td>
                <td>สำนักงานใหญ่</td>
              </tr>
              <tr>
                <td className="a4-company-meta-label font-semibold">เลขประจำตัวผู้เสียภาษี</td>
                <td>1250200133469</td>
              </tr>
            </tbody>
          </table>
          <p className="a4-issued-badge font-bold text-base">เอกสารออกเป็นชุด</p>
        </div>
      </div>

      {/* Document Title Banner */}
      <div className="a4-doc-banner bg-[#fdfcdc] text-center border border-[#e5e7eb] font-bold text-lg avoid-break">
        {data.documentTypeLabel || 'ใบเสร็จรับเงิน / ใบกำกับภาษี'}
      </div>

      {/* ──────────────── CUSTOMER & DOC INFO ──────────────── */}
      <div className="a4-party-box flex w-full border border-black avoid-break">
        
        {/* Customer Box (Left) */}
        <div className="a4-pane-padding w-2/3 border-r border-black flex flex-col justify-between">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="a4-customer-cell-label font-bold w-[70px] align-top">ชื่อลูกค้า</td>
                <td className="a4-customer-cell-value align-top">{data.customerName}</td>
              </tr>
              <tr>
                <td className="a4-customer-cell-label font-bold align-top">ที่อยู่</td>
                <td className="a4-customer-cell-value align-top">{data.customerAddress}</td>
              </tr>
              <tr>
                <td className="a4-customer-cell-label font-bold align-top">โทรศัพท์</td>
                <td className="a4-customer-cell-value align-top">{data.customerPhone}</td>
              </tr>
              <tr>
                <td className="a4-customer-cell-label font-bold align-top">แฟกซ์</td>
                <td className="a4-customer-cell-value align-top">{data.customerFax || '-'}</td>
              </tr>
            </tbody>
          </table>
          <div className="a4-customer-meta-row flex gap-4 font-bold text-sm">
            <span>สาขา <span className="font-normal">{data.customerBranch}</span></span>
            <span>เลขประจำตัวผู้เสียภาษี <span className="font-normal">{data.customerTaxId}</span></span>
          </div>
        </div>

        {/* Doc Info Box (Right) */}
        <div className="a4-pane-padding w-1/3">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="a4-docinfo-label font-bold w-[80px]">เลขที่เอกสาร</td>
                <td className="a4-docinfo-value">{data.documentNumber}</td>
              </tr>
              <tr>
                <td className="a4-docinfo-label font-bold">วันที่</td>
                <td className="a4-docinfo-value">{data.documentDate}</td>
              </tr>
              <tr>
                <td className="a4-docinfo-label font-bold">อ้างถึง</td>
                <td className="a4-docinfo-value">{data.reference || '-'}</td>
              </tr>
              <tr>
                <td className="a4-docinfo-label font-bold">ชนิดการขาย</td>
                <td className="a4-docinfo-value">{data.saleType || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────── ITEMS TABLE ──────────────── */}
      <div className="a4-items-wrap flex-1 min-h-[300px] border-b border-black">
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
      <div className="a4-footer-wrap flex w-full border border-black avoid-break">
        
        {/* Left Footer (Remark & Baht Text) */}
        <div className="a4-pane-padding w-2/3 flex flex-col justify-between border-r border-black">
          <div>
            <p className="a4-note-title font-bold">หมายเหตุ</p>
            <p className="text-xs">{data.remark}</p>
          </div>
          
          <div className="a4-baht-wrap">
            <div className="a4-baht-highlight bg-[#fdfcdc] text-center font-bold">
              {bahtText(data.grandTotal)}
            </div>
            <div className="a4-terms-list text-[11px] leading-tight">
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
                <td className="a4-total-cell font-bold">ส่วนลดการค้า</td>
                <td className="a4-total-cell text-right">{formatNum(data.discountTotal)}</td>
              </tr>
              <tr className="border-b border-[#e5e7eb]">
                <td className="a4-total-cell font-bold">มูลค่าสินค้า</td>
                <td className="a4-total-cell text-right">{formatNum(data.subTotal)}</td>
              </tr>
              <tr className="border-b border-[#e5e7eb]">
                <td className="a4-total-cell font-bold">ภาษีมูลค่าเพิ่ม</td>
                <td className="a4-total-cell text-right">{formatNum(data.vatAmount)}</td>
              </tr>
              <tr>
                <td className="a4-total-cell font-bold text-base">รวมทั้งสิ้น</td>
                <td className="a4-total-cell text-right font-bold text-base">{formatNum(data.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────── SIGNATURES ──────────────── */}
      <div className="a4-signatures-wrap flex justify-between w-full avoid-break text-center text-sm">
        <div className="w-1/3">
          <p className="a4-sign-title font-bold text-left">ผู้อนุมัติ</p>
          <div className="a4-sign-line border-b border-black w-[80%] mx-auto"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
        <div className="w-1/3">
          <p className="a4-sign-title font-bold text-left">ผู้รับเงิน</p>
          <div className="a4-sign-line border-b border-black w-[80%] mx-auto"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
        <div className="w-1/3">
          <p className="a4-sign-title font-bold text-left">ผู้รับสินค้า</p>
          <div className="a4-sign-line border-b border-black w-[80%] mx-auto"></div>
          <p>( <span className="inline-block w-32"></span> )</p>
        </div>
      </div>

    </div>
  );
}
