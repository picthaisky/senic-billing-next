import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, FileSpreadsheet, ListTree, Plus, Save, Scale, Trash2, TrendingUp, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface ChartOfAccountDto {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isSystem: boolean;
  isActive: boolean;
}

interface JournalEntryDto {
  id: string;
  journalNumber: string;
  entryDate: string;
  description: string;
  sourceType: string;
  sourceNumber?: string | null;
  lines: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    memo?: string | null;
  }>;
}

interface TrialBalanceDto {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  rows: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
  }>;
}

interface ProfitLossDto {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  revenueAccounts: TrialBalanceDto['rows'];
  expenseAccounts: TrialBalanceDto['rows'];
}

const fmt = (v: number) => `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Asset: 'สินทรัพย์ (Asset)',
  Liability: 'หนี้สิน (Liability)',
  Equity: 'ส่วนของเจ้าของ (Equity)',
  Revenue: 'รายได้ (Revenue)',
  Expense: 'ค่าใช้จ่าย (Expense)',
};

interface ManualLineForm {
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
}

export default function AccountingPage() {
  const [tab, setTab] = useState<'journals' | 'tb' | 'pnl' | 'accounts'>('journals');
  const [accounts, setAccounts] = useState<ChartOfAccountDto[]>([]);
  const [journals, setJournals] = useState<JournalEntryDto[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceDto | null>(null);
  const [pnl, setPnl] = useState<ProfitLossDto | null>(null);
  const [jvModalOpen, setJvModalOpen] = useState(false);
  const [savingJv, setSavingJv] = useState(false);
  const [jvForm, setJvForm] = useState<{
    entryDate: string;
    description: string;
    lines: ManualLineForm[];
  }>({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { accountId: '', debit: 0, credit: 0, memo: '' },
      { accountId: '', debit: 0, credit: 0, memo: '' },
    ],
  });

  const loadAccountingData = useCallback(async () => {
    const [accRes, jRes, tbRes, pnlRes] = await Promise.all([
      apiClient.get('/accounting/accounts'),
      apiClient.get('/accounting/journals'),
      apiClient.get('/accounting/trial-balance'),
      apiClient.get('/accounting/profit-loss'),
    ]);
    return {
      accounts: (accRes.data?.data ?? []) as ChartOfAccountDto[],
      journals: (jRes.data?.data ?? []) as JournalEntryDto[],
      trialBalance: (tbRes.data?.data ?? null) as TrialBalanceDto | null,
      pnl: (pnlRes.data?.data ?? null) as ProfitLossDto | null,
    };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const result = await loadAccountingData();
      setAccounts(result.accounts);
      setJournals(result.journals);
      setTrialBalance(result.trialBalance);
      setPnl(result.pnl);
    } catch (err) {
      console.error('Failed to load accounting data:', err);
    }
  }, [loadAccountingData]);

  const openManualJvModal = () => {
    const firstId = accounts[0]?.id ?? '';
    const secondId = accounts[1]?.id ?? firstId;
    setJvForm({
      entryDate: new Date().toISOString().split('T')[0],
      description: '',
      lines: [
        { accountId: firstId, debit: 0, credit: 0, memo: '' },
        { accountId: secondId, debit: 0, credit: 0, memo: '' },
      ],
    });
    setJvModalOpen(true);
  };

  const totalJvDebit = jvForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalJvCredit = jvForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isJvBalanced = totalJvDebit > 0 && Math.abs(totalJvDebit - totalJvCredit) < 0.005;

  const handleSaveManualJv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jvForm.description.trim()) {
      alert('กรุณาระบุคำอธิบายรายการ');
      return;
    }
    const validLines = jvForm.lines
      .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo.trim() || null,
      }));
    if (validLines.length < 2) {
      alert('สมุดรายวันต้องมีอย่างน้อย 2 บรรทัดที่มียอดเดบิตหรือเครดิต');
      return;
    }
    const sumDr = validLines.reduce((s, l) => s + l.debit, 0);
    const sumCr = validLines.reduce((s, l) => s + l.credit, 0);
    if (sumDr <= 0 || Math.abs(sumDr - sumCr) >= 0.005) {
      alert('ยอดเดบิตและเครดิตต้องเท่ากันและมากกว่า 0');
      return;
    }

    setSavingJv(true);
    try {
      await apiClient.post('/accounting/journals', {
        entryDate: `${jvForm.entryDate}T00:00:00Z`,
        description: jvForm.description.trim(),
        lines: validLines,
      });
      setJvModalOpen(false);
      await fetchAll();
    } catch (err: unknown) {
      const apiMessage =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(apiMessage || 'ไม่สามารถบันทึกรายการสมุดรายวันได้');
    } finally {
      setSavingJv(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadAccountingData()
      .then((result) => {
        if (!active) return;
        setAccounts(result.accounts);
        setJournals(result.journals);
        setTrialBalance(result.trialBalance);
        setPnl(result.pnl);
      })
      .catch((err) => {
        console.error('Failed to load accounting data:', err);
      });
    return () => {
      active = false;
    };
  }, [loadAccountingData]);

  const downloadFile = async (endpoint: string, filename: string, mime: string) => {
    try {
      const res = await apiClient.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถส่งออกไฟล์สมุดบัญชีได้');
    }
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">บัญชีอัตโนมัติ &amp; งบการเงิน (Auto-Accounting)</h2>
            <p className="text-sm text-[var(--color-text-muted)]">สมุดรายวันทั่วไป (Double-Entry) งบทดลอง และงบกำไรขาดทุนเบื้องต้น</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openManualJvModal}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus size={15} /> บันทึกรายวัน (Manual JV)
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadFile(
                '/accounting/export/excel',
                'สมุดรายวันทั่วไป.xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              )
            }
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} /> ส่งออก Excel
          </button>
          <button
            type="button"
            onClick={() => void downloadFile('/accounting/export/csv', 'JournalEntries.csv', 'text/csv;charset=utf-8')}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={15} /> ส่งออก CSV (Express/FlowAccount)
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">รายได้รวม (ปีนี้)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(pnl?.totalRevenue ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">ค่าใช้จ่ายรวม (ปีนี้)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(pnl?.totalExpense ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">กำไร (ขาดทุน) สุทธิเบื้องต้น</p>
          <p className={`text-2xl font-bold mt-1 ${(pnl?.netProfit ?? 0) >= 0 ? 'text-[var(--color-primary)]' : 'text-red-600'}`}>
            {fmt(pnl?.netProfit ?? 0)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('journals')} className={`btn text-xs ${tab === 'journals' ? 'btn-primary' : 'btn-secondary'}`}>
          <BookOpen size={14} /> สมุดรายวันทั่วไป ({journals.length})
        </button>
        <button type="button" onClick={() => setTab('tb')} className={`btn text-xs ${tab === 'tb' ? 'btn-primary' : 'btn-secondary'}`}>
          <Scale size={14} /> งบทดลอง (Trial Balance)
        </button>
        <button type="button" onClick={() => setTab('pnl')} className={`btn text-xs ${tab === 'pnl' ? 'btn-primary' : 'btn-secondary'}`}>
          <TrendingUp size={14} /> งบกำไรขาดทุน (P&amp;L)
        </button>
        <button type="button" onClick={() => setTab('accounts')} className={`btn text-xs ${tab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}>
          <ListTree size={14} /> ผังบัญชี ({accounts.length})
        </button>
      </div>

      {tab === 'journals' && (
        <div className="space-y-3">
          {journals.length === 0 ? (
            <div className="card p-8 text-center text-[var(--color-text-muted)]">ยังไม่มีรายการสมุดรายวัน — ระบบจะลงบัญชีให้อัตโนมัติเมื่อออกบิลหรือบันทึกค่าใช้จ่าย</div>
          ) : (
            journals.map((j) => (
              <div key={j.id} className="card p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
                  <div>
                    <span className="font-mono font-bold text-sm text-[var(--color-primary)]">{j.journalNumber}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-3">{new Date(j.entryDate).toLocaleDateString('th-TH')}</span>
                    <span className="text-sm font-medium ml-3">{j.description}</span>
                  </div>
                  <span className="badge badge-info text-[10px]">{j.sourceType} {j.sourceNumber ? `• ${j.sourceNumber}` : ''}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--color-text-muted)]">
                      <th className="text-left py-1">รหัสบัญชี</th>
                      <th className="text-left py-1">ชื่อบัญชี</th>
                      <th className="text-right py-1">เดบิต (Dr.)</th>
                      <th className="text-right py-1">เครดิต (Cr.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.lines.map((l) => (
                      <tr key={l.id} className="border-t border-[var(--color-border)]/40">
                        <td className="py-1 font-mono">{l.accountCode}</td>
                        <td className="py-1">{l.accountName}</td>
                        <td className="py-1 text-right font-mono">{l.debit > 0 ? fmt(l.debit) : '-'}</td>
                        <td className="py-1 text-right font-mono">{l.credit > 0 ? fmt(l.credit) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'tb' && trialBalance && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="font-bold text-sm">งบทดลอง (Trial Balance)</span>
            <span className={`badge ${trialBalance.isBalanced ? 'badge-success' : 'badge-danger'}`}>
              {trialBalance.isBalanced ? 'สมดุล (Debit = Credit)' : 'ไม่สมดุล'}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>รหัสบัญชี</th>
                <th>ชื่อบัญชี</th>
                <th>หมวด</th>
                <th className="text-right">เดบิต</th>
                <th className="text-right">เครดิต</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.rows.map((r) => (
                <tr key={r.accountId}>
                  <td className="font-mono text-sm">{r.accountCode}</td>
                  <td className="text-sm">{r.accountName}</td>
                  <td><span className="badge badge-info text-[10px]">{r.accountType}</span></td>
                  <td className="text-right font-mono text-sm">{fmt(r.totalDebit)}</td>
                  <td className="text-right font-mono text-sm">{fmt(r.totalCredit)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-[var(--color-bg-secondary)]">
                <td colSpan={3} className="text-right">รวมทั้งสิ้น</td>
                <td className="text-right font-mono">{fmt(trialBalance.totalDebit)}</td>
                <td className="text-right font-mono">{fmt(trialBalance.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pnl' && pnl && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h4 className="font-bold text-emerald-600 border-b border-[var(--color-border)] pb-2">หมวดรายได้ (Revenue)</h4>
            {pnl.revenueAccounts.map((r) => (
              <div key={r.accountId} className="flex justify-between text-sm">
                <span>{r.accountCode} {r.accountName}</span>
                <span className="font-mono font-semibold">{fmt(r.netBalance)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2">
              <span>รวมรายได้</span>
              <span className="font-mono text-emerald-600">{fmt(pnl.totalRevenue)}</span>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h4 className="font-bold text-amber-600 border-b border-[var(--color-border)] pb-2">หมวดต้นทุนและค่าใช้จ่าย (Expenses)</h4>
            {pnl.expenseAccounts.map((r) => (
              <div key={r.accountId} className="flex justify-between text-sm">
                <span>{r.accountCode} {r.accountName}</span>
                <span className="font-mono font-semibold">{fmt(r.netBalance)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2">
              <span>รวมค่าใช้จ่าย</span>
              <span className="font-mono text-amber-600">{fmt(pnl.totalExpense)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="font-bold text-sm">ผังบัญชีมาตรฐาน (Chart of Accounts)</span>
            <span className="text-xs text-[var(--color-text-muted)]">ทั้งหมด {accounts.length} บัญชี</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสบัญชี</th>
                  <th>ชื่อบัญชี</th>
                  <th>หมวดบัญชี</th>
                  <th className="text-center">ประเภท</th>
                  <th className="text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[var(--color-text-muted)]">ไม่พบข้อมูลผังบัญชี</td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="font-mono font-semibold text-sm text-[var(--color-primary)]">{acc.code}</td>
                      <td className="text-sm">{acc.name}</td>
                      <td>
                        <span className="badge badge-info text-[10px]">
                          {ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType}
                        </span>
                      </td>
                      <td className="text-center text-xs text-[var(--color-text-muted)]">
                        {acc.isSystem ? 'บัญชีมาตรฐานระบบ' : 'กำหนดเอง'}
                      </td>
                      <td className="text-center">
                        <span className={`badge text-[10px] ${acc.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {acc.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Journal Entry Modal */}
      {jvModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg">บันทึกรายวันทั่วไป (Manual Journal Entry)</h3>
                <button type="button" onClick={() => setJvModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={(e) => void handleSaveManualJv(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">วันที่ลงบัญชี *</label>
                    <input
                      required
                      type="date"
                      className="input-field"
                      value={jvForm.entryDate}
                      onChange={(e) => setJvForm({ ...jvForm, entryDate: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">คำอธิบายรายการ *</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="เช่น บันทึกจ่ายค่าเช่าสำนักงาน / ปรับปรุงบัญชีสิ้นเดือน"
                      value={jvForm.description}
                      onChange={(e) => setJvForm({ ...jvForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">รายการเดบิต / เครดิต (อย่างน้อย 2 บรรทัด)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setJvForm((prev) => ({
                          ...prev,
                          lines: [...prev.lines, { accountId: accounts[0]?.id ?? '', debit: 0, credit: 0, memo: '' }],
                        }))
                      }
                      className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <Plus size={14} /> เพิ่มบรรทัด
                    </button>
                  </div>

                  <div className="space-y-2">
                    {jvForm.lines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          className="input-field col-span-5 text-xs"
                          value={line.accountId}
                          onChange={(e) => {
                            const next = [...jvForm.lines];
                            next[idx] = { ...next[idx], accountId: e.target.value };
                            setJvForm({ ...jvForm, lines: next });
                          }}
                        >
                          <option value="">-- เลือกบัญชี --</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="เดบิต"
                          className="input-field col-span-2 text-right font-mono text-xs"
                          value={line.debit || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const next = [...jvForm.lines];
                            next[idx] = { ...next[idx], debit: val, credit: val > 0 ? 0 : next[idx].credit };
                            setJvForm({ ...jvForm, lines: next });
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="เครดิต"
                          className="input-field col-span-2 text-right font-mono text-xs"
                          value={line.credit || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const next = [...jvForm.lines];
                            next[idx] = { ...next[idx], credit: val, debit: val > 0 ? 0 : next[idx].debit };
                            setJvForm({ ...jvForm, lines: next });
                          }}
                        />
                        <input
                          type="text"
                          placeholder="หมายเหตุ"
                          className="input-field col-span-2 text-xs"
                          value={line.memo}
                          onChange={(e) => {
                            const next = [...jvForm.lines];
                            next[idx] = { ...next[idx], memo: e.target.value };
                            setJvForm({ ...jvForm, lines: next });
                          }}
                        />
                        <button
                          type="button"
                          disabled={jvForm.lines.length <= 2}
                          onClick={() =>
                            setJvForm((prev) => ({
                              ...prev,
                              lines: prev.lines.filter((_, i) => i !== idx),
                            }))
                          }
                          className="col-span-1 p-1.5 rounded-lg text-red-600 hover:bg-red-500/10 disabled:opacity-30 flex justify-center"
                          title="ลบบรรทัด"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-bg-secondary)] p-3 text-xs">
                  <div className="flex gap-4 font-mono">
                    <span>รวมเดบิต: <strong>{fmt(totalJvDebit)}</strong></span>
                    <span>รวมเครดิต: <strong>{fmt(totalJvCredit)}</strong></span>
                  </div>
                  <span className={`badge ${isJvBalanced ? 'badge-success' : 'badge-warning'}`}>
                    {isJvBalanced ? 'ยอดดุลพร้อมบันทึก' : `ผลต่าง ${fmt(Math.abs(totalJvDebit - totalJvCredit))}`}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setJvModalOpen(false)} className="btn btn-secondary">ยกเลิก</button>
                  <button type="submit" disabled={savingJv || !isJvBalanced} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
                    <Save size={16} /> {savingJv ? 'กำลังบันทึก...' : 'บันทึกรายวัน'}
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

