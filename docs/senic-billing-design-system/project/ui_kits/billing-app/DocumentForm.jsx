// DocumentForm — mirrors forms/InvoiceForm.tsx (customer info, line items, VAT totals)
const { useState: useS, useCallback } = React;

const DOC_CFG = {
  taxinvoice: { prefix: 'INV', color: '#ea580c', title: 'ใบกำกับภาษี' },
  receipt: { prefix: 'RCP', color: '#16a34a', title: 'ใบเสร็จรับเงิน' },
  cashbill: { prefix: 'CSB', color: '#2563eb', title: 'บิลเงินสด' },
  delivery: { prefix: 'DLV', color: '#9333ea', title: 'ใบส่งของ' },
};
const fnum = (n) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
let _lid = 0;
const newLine = (d = '', q = 1, u = 'ชิ้น', p = 0) => ({ id: ++_lid, description: d, quantity: q, unit: u, unitPrice: p, discount: 0 });

function DocumentForm({ type }) {
  const cfg = DOC_CFG[type] || DOC_CFG.taxinvoice;
  const [lines, setLines] = useS([
    newLine('หมึกพิมพ์ Toner HP 85A', 2, 'กล่อง', 2890),
    newLine('กระดาษ A4 80แกรม', 10, 'รีม', 135),
    newLine('', 1, 'ชิ้น', 0),
  ]);
  const [vatMode, setVatMode] = useS('exclusive');
  const [discount, setDiscount] = useS(0);
  const [customer, setCustomer] = useS('บจก. เอบีซี เทรดดิ้ง');
  const [taxId, setTaxId] = useS('0105548091123');

  const update = (id, patch) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  const remove = (id) => setLines(ls => ls.length === 1 ? ls : ls.filter(l => l.id !== id));
  const add = () => setLines(ls => [...ls, newLine()]);
  const lineTotal = (l) => Math.max(0, l.quantity * l.unitPrice - l.discount);

  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const afterDisc = Math.max(0, subtotal - discount);
  const beforeVat = vatMode === 'inclusive' ? afterDisc / 1.07 : afterDisc;
  const vat = vatMode === 'inclusive' ? afterDisc - beforeVat : afterDisc * 0.07;
  const grand = vatMode === 'inclusive' ? afterDisc : afterDisc + vat;

  const onKey = (e, last) => { if (e.key === 'Enter' && last) { e.preventDefault(); add(); } };

  return (
    <div className="content-inner" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="doc-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="doc-bar" style={{ background: cfg.color }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{cfg.title}</h2>
            <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
              เลขที่เอกสาร: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: cfg.color }}>{cfg.prefix}-202606-AUTO</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-ghost"><Icons.RotateCcw size={15} />ล้างข้อมูล</button>
          <button className="btn btn-secondary"><Icons.Printer size={15} />พิมพ์</button>
          <button className="btn btn-secondary" style={{ background: 'rgba(99,102,241,.08)', color: '#4f46e5', borderColor: 'rgba(99,102,241,.25)' }}><Icons.CreditCard size={15} />ชำระเงินออนไลน์</button>
          <button className="btn btn-primary"><Icons.Save size={15} />บันทึกเอกสาร</button>
        </div>
      </div>

      {/* Customer */}
      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>ข้อมูลลูกค้า</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>ชื่อลูกค้า / บริษัท <span style={{ color: '#f87171' }}>*</span></label>
            <input className="input-field" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="พิมพ์เพื่อค้นหา..." />
          </div>
          {type === 'taxinvoice' && (
            <div>
              <label className="field-label" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
              <input className="input-field" style={{ fontFamily: 'var(--font-mono)' }} value={taxId} maxLength={13} onChange={e => setTaxId(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="thead-row" style={{ padding: '14px 20px' }}>
          <div className="eyebrow">รายการสินค้า / บริการ</div>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={add}><Icons.Plus size={14} />เพิ่มรายการ</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>#</th><th>รายละเอียด</th>
                <th style={{ width: 84, textAlign: 'right' }}>จำนวน</th><th style={{ width: 70 }}>หน่วย</th>
                <th style={{ width: 110, textAlign: 'right' }}>ราคา/หน่วย</th><th style={{ width: 96, textAlign: 'right' }}>ส่วนลด</th>
                <th style={{ width: 110, textAlign: 'right' }}>รวม</th><th style={{ width: 42 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="animate-fade-in">
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td><input className="input-field" style={iss} placeholder="ชื่อสินค้า / รายละเอียด" value={l.description} onChange={e => update(l.id, { description: e.target.value })} onKeyDown={e => onKey(e, i === lines.length - 1)} /></td>
                  <td><input type="number" className="input-field" style={{ ...iss, textAlign: 'right' }} value={l.quantity || ''} onChange={e => update(l.id, { quantity: parseFloat(e.target.value) || 0 })} /></td>
                  <td><input className="input-field" style={{ ...iss, textAlign: 'center' }} value={l.unit} onChange={e => update(l.id, { unit: e.target.value })} /></td>
                  <td><input type="number" className="input-field" style={{ ...iss, textAlign: 'right' }} value={l.unitPrice || ''} onChange={e => update(l.id, { unitPrice: parseFloat(e.target.value) || 0 })} /></td>
                  <td><input type="number" className="input-field" style={{ ...iss, textAlign: 'right' }} value={l.discount || ''} onChange={e => update(l.id, { discount: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{fnum(lineTotal(l))}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="icon-btn" onClick={() => remove(l.id)} disabled={lines.length === 1} style={{ color: lines.length === 1 ? 'var(--color-text-muted)' : '#dc2626' }}><Icons.Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>ตั้งค่าภาษี</div>
          <div className="seg" style={{ marginBottom: 16 }}>
            <button className={vatMode === 'exclusive' ? 'on' : ''} onClick={() => setVatMode('exclusive')}>ราคาแยกภาษี</button>
            <button className={vatMode === 'inclusive' ? 'on' : ''} onClick={() => setVatMode('inclusive')}>ราคารวมภาษี</button>
          </div>
          <label className="field-label" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>ส่วนลดรวม (บาท)</label>
          <input type="number" className="input-field" style={{ textAlign: 'right' }} value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>สรุปยอดรวม</div>
          <div className="totrow"><span style={{ color: 'var(--color-text-secondary)' }}>ยอดรวมก่อนส่วนลด</span><span className="num">{fnum(subtotal)}</span></div>
          {discount > 0 && <div className="totrow"><span style={{ color: 'var(--color-text-secondary)' }}>ส่วนลดรวม</span><span className="num" style={{ color: '#ef4444' }}>-{fnum(discount)}</span></div>}
          <div className="totrow"><span style={{ color: 'var(--color-text-secondary)' }}>ยอดรวม{vatMode === 'inclusive' ? '' : 'ก่อน'}ภาษี</span><span className="num">{fnum(beforeVat)}</span></div>
          <div className="totrow"><span style={{ color: 'var(--color-text-secondary)' }}>ภาษีมูลค่าเพิ่ม 7% <span style={{ fontSize: 12, opacity: .6 }}>({vatMode === 'exclusive' ? 'แยก' : 'รวม'})</span></span><span className="num">{fnum(vat)}</span></div>
          <div className="totrow" style={{ borderTop: '1px solid var(--color-border)', marginTop: 10, paddingTop: 12, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>ยอดรวมสุทธิ</span>
            <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>฿{fnum(grand)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
const iss = { padding: '8px 10px', fontSize: 14 };
window.DocumentForm = DocumentForm;
