// Dashboard — mirrors dashboard/DashboardPage.tsx (KPIs, bar + donut charts, recent docs)
const REVENUE = [
  { m: 'ม.ค.', goods: 120000, vat: 8400 },
  { m: 'ก.พ.', goods: 150000, vat: 10500 },
  { m: 'มี.ค.', goods: 140000, vat: 9800 },
  { m: 'เม.ย.', goods: 180000, vat: 12600 },
  { m: 'พ.ค.', goods: 210000, vat: 14700 },
  { m: 'มิ.ย.', goods: 250000, vat: 17500 },
];
const PRODUCTS = [
  { name: 'หมึกพิมพ์ Toner', value: 85000 },
  { name: 'กระดาษ A4', value: 45000 },
  { name: 'บริการซ่อม', value: 30000 },
  { name: 'เครื่องเขียน', value: 15000 },
  { name: 'แฟ้มเอกสาร', value: 12000 },
];
const RECENT = [
  { n: 'INV-202606-0012', type: 'ใบกำกับภาษี', cls: 'badge-info', cust: 'บจก. เอบีซี', amt: 32100, t: '2 ชม.ที่แล้ว', icon: 'FileCheck' },
  { n: 'RCP-202606-0045', type: 'ใบเสร็จรับเงิน', cls: 'b-green', cust: 'ร้านมิตรภาพ', amt: 8500, t: '5 ชม.ที่แล้ว', icon: 'Receipt' },
  { n: 'CSB-202606-0023', type: 'บิลเงินสด', cls: 'b-blue', cust: 'คุณสมชาย', amt: 3200, t: 'เมื่อวาน', icon: 'Banknote' },
  { n: 'DLV-202606-0018', type: 'ใบส่งของ', cls: 'b-purple', cust: 'บจก. ดีเอฟจี', amt: 67800, t: 'เมื่อวาน', icon: 'Truck' },
];
const TYPE_STYLE = {
  'badge-info': {}, 'b-green': { background: 'rgba(22,163,74,.1)', color: '#16a34a' },
  'b-blue': { background: 'rgba(37,99,235,.1)', color: '#2563eb' }, 'b-purple': { background: 'rgba(147,51,234,.1)', color: '#9333ea' },
};
const CHART_PAL = {
  'warm-horizon': ['#ea580c', '#f97316', '#fbbf24', '#fcd34d', '#fed7aa'],
  'deep-ocean': ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'],
};
const baht = (v) => '฿' + new Intl.NumberFormat('th-TH').format(v);
const num2 = (v) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function Kpi({ icon, val, label, change, up = true, delay }) {
  const Icon = Icons[icon];
  return (
    <div className="kpi-card kpi animate-fade-in-up" style={{ animationDelay: delay }}>
      <div className="kpi-wm"><Icon size={80} stroke={2} /></div>
      <div className="kpi-top">
        <div className="kpi-tile"><Icon size={20} /></div>
        <span className="kpi-chg" style={{ color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {up ? <Icons.ArrowUpRight size={12} stroke={2.5} /> : <Icons.ArrowDownRight size={12} stroke={2.5} />}{change}
        </span>
      </div>
      <div className="kpi-val">{val}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}

function BarChart({ theme }) {
  const max = 260000;
  const pal = CHART_PAL[theme] || CHART_PAL['warm-horizon'];
  const c1 = pal[0], c2 = pal[2];
  return (
    <div className="bars">
      {REVENUE.map((r) => (
        <div className="bar-col" key={r.m}>
          <div className="bar-pair">
            <div className="bar" style={{ height: (r.goods / max * 100) + '%', background: c1 }} title={baht(r.goods)} />
            <div className="bar" style={{ height: (r.vat / max * 100) + '%', background: c2 }} title={baht(r.vat)} />
          </div>
          <span className="bar-x">{r.m}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ theme }) {
  const total = PRODUCTS.reduce((s, p) => s + p.value, 0);
  const colors = CHART_PAL[theme] || CHART_PAL['warm-horizon'];
  let acc = 0;
  const stops = PRODUCTS.map((p, i) => {
    const start = acc / total * 360; acc += p.value;
    const end = acc / total * 360;
    return `${colors[i]} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
        <div style={{ width: 150, height: 150, borderRadius: '50%', background: `conic-gradient(${stops})` }} />
        <div style={{ position: 'absolute', inset: 30, borderRadius: '50%', background: 'var(--color-surface-solid)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>รวม</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{baht(total)}</div>
        </div>
      </div>
      <div className="legend">
        {PRODUCTS.map((p, i) => (
          <div className="legend-row" key={p.name}>
            <span className="sw" style={{ background: colors[i] }} />{p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ theme, onNewDoc }) {
  return (
    <div className="content-inner">
      <div className="kpi-grid">
        <Kpi icon="TrendingUp" val="฿1,050,000" label="รายได้รวม — เทียบเดือนก่อน" change="+18.5%" delay="0.05s" />
        <Kpi icon="FileText" val="156" label="เอกสารที่ออก — เดือนนี้" change="+12" delay="0.1s" />
        <Kpi icon="Clock" val="8" label="รอดำเนินการ — เอกสารร่าง" change="-3" delay="0.15s" />
        <Kpi icon="TrendingUp" val="+23.4%" label="เติบโต MoM — เทียบเดือนก่อน" change="+5.2%" delay="0.2s" />
      </div>

      <div className="chart-grid">
        <div className="card" style={{ padding: 24 }}>
          <div className="chart-head">
            <div><div className="sec-title">แนวโน้มรายได้ และ ภาษีขาย</div><div className="sec-sub">มูลค่ารวมจากการออกเอกสาร 6 เดือนล่าสุด</div></div>
            <span className="badge badge-neutral">6 เดือน</span>
          </div>
          <BarChart theme={theme} />
          <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--chart-1)' }} />มูลค่าสินค้า</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--chart-3)' }} />ภาษีขาย 7%</span>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="chart-head">
            <div><div className="sec-title">สัดส่วนสินค้าที่ขายดี</div><div className="sec-sub">Top 5 รายการจัดตามมูลค่า</div></div>
            <span className="badge badge-neutral">จัดตามมูลค่า</span>
          </div>
          <Donut theme={theme} />
        </div>
      </div>

      <div className="card tablecard">
        <div className="thead-row">
          <div className="sec-title">เอกสารล่าสุด</div>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}><Icons.Download size={14} />ส่งออก Excel</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>เลขที่เอกสาร</th><th>ประเภท</th><th>ลูกค้า</th><th style={{ textAlign: 'right' }}>จำนวนเงิน</th><th style={{ textAlign: 'right' }}>เวลา</th><th style={{ textAlign: 'center', width: 70 }}>จัดการ</th></tr>
          </thead>
          <tbody>
            {RECENT.map((d) => {
              const Icon = Icons[d.icon];
              return (
                <tr key={d.n}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon size={16} style={{ color: 'var(--color-primary)' }} /><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>{d.n}</span></div></td>
                  <td><span className={'badge ' + (d.cls === 'badge-info' ? 'badge-info' : '')} style={TYPE_STYLE[d.cls]}>{d.type}</span></td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{d.cust}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{num2(d.amt)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{d.t}</td>
                  <td style={{ textAlign: 'center' }}><button className="icon-btn" title="พิมพ์"><Icons.Printer size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
