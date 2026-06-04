// DataPage — customers & products list (mirrors CustomersPage / ProductsPage table style)
const CUSTOMERS = [
  { name: 'บจก. เอบีซี เทรดดิ้ง', tax: '0105548091123', phone: '02-123-4567', docs: 24, total: 482000 },
  { name: 'ร้านมิตรภาพการค้า', tax: '0105549002231', phone: '081-234-5678', docs: 12, total: 96500 },
  { name: 'คุณสมชาย ใจกว้าง', tax: '—', phone: '089-876-5432', docs: 7, total: 31200 },
  { name: 'บจก. ดีเอฟจี อุตสาหกรรม', tax: '0105550118822', phone: '02-998-7766', docs: 31, total: 1240000 },
  { name: 'หจก. รุ่งเรืองพาณิชย์', tax: '0103551224410', phone: '044-212-334', docs: 5, total: 18900 },
];
const PRODUCTS_T = [
  { name: 'หมึกพิมพ์ Toner HP 85A', sku: 'TNR-085A', unit: 'กล่อง', price: 2890, stock: 42 },
  { name: 'กระดาษ A4 80แกรม', sku: 'PPR-A4-80', unit: 'รีม', price: 135, stock: 320 },
  { name: 'แฟ้มเอกสาร 3 ห่วง', sku: 'FLD-3R', unit: 'อัน', price: 89, stock: 156 },
  { name: 'ปากกาลูกลื่น น้ำเงิน', sku: 'PEN-BL', unit: 'แพ็ค', price: 45, stock: 0 },
  { name: 'บริการซ่อมเครื่องพิมพ์', sku: 'SRV-FIX', unit: 'ครั้ง', price: 850, stock: null },
];
const thb0 = (v) => '฿' + new Intl.NumberFormat('th-TH').format(v);

function DataPage({ type }) {
  const isCust = type === 'customers';
  return (
    <div className="content-inner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="sec-title" style={{ fontSize: 18 }}>{isCust ? 'รายชื่อลูกค้า' : 'รายการสินค้า'}</div>
          <div className="sec-sub">{isCust ? `ทั้งหมด ${CUSTOMERS.length} ราย` : `ทั้งหมด ${PRODUCTS_T.length} รายการ`}</div>
        </div>
        <button className="btn btn-primary"><Icons.Plus size={15} />{isCust ? 'เพิ่มลูกค้า' : 'เพิ่มสินค้า'}</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {isCust ? (
            <table className="data-table">
              <thead><tr><th>ชื่อลูกค้า</th><th>เลขผู้เสียภาษี</th><th>โทรศัพท์</th><th style={{ textAlign: 'right' }}>เอกสาร</th><th style={{ textAlign: 'right' }}>มูลค่ารวม</th></tr></thead>
              <tbody>
                {CUSTOMERS.map((c) => (
                  <tr key={c.name}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--color-primary-50)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{c.name.replace(/^(บจก\.|หจก\.|ร้าน|คุณ)\s*/, '').charAt(0)}</div>
                      <span style={{ fontWeight: 600 }}>{c.name}</span></div></td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontSize: 13 }}>{c.tax}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{c.phone}</td>
                    <td style={{ textAlign: 'right' }}>{c.docs}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{thb0(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead><tr><th>สินค้า</th><th>SKU</th><th>หน่วย</th><th style={{ textAlign: 'right' }}>ราคา</th><th style={{ textAlign: 'right' }}>คงเหลือ</th></tr></thead>
              <tbody>
                {PRODUCTS_T.map((p) => (
                  <tr key={p.sku}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontSize: 13 }}>{p.sku}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.unit}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{thb0(p.price)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.stock === null ? <span className="badge badge-neutral">บริการ</span>
                        : p.stock === 0 ? <span className="badge badge-danger">หมด</span>
                        : <span className="badge badge-success">{p.stock}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="content-inner" style={{ maxWidth: 760 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>ข้อมูลกิจการ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><label className="field-label">ชื่อกิจการ</label><input className="input-field" defaultValue="บริษัท เซนิค คอร์ป จำกัด" /></div>
          <div><label className="field-label">เลขประจำตัวผู้เสียภาษี</label><input className="input-field" style={{ fontFamily: 'var(--font-mono)' }} defaultValue="0105561009988" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label className="field-label">ที่อยู่</label><input className="input-field" defaultValue="123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110" /></div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary">ยกเลิก</button>
          <button className="btn btn-primary"><Icons.Save size={15} />บันทึกการตั้งค่า</button>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { DataPage, SettingsPage });
