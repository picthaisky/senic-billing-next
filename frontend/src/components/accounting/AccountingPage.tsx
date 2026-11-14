import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  Landmark,
  ListTree,
  Lock,
  PieChart,
  Plus,
  Save,
  Scale,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Unlock,
  WalletCards,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../store/useAuthStore';

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

interface BalanceSheetDto {
  asOfDate: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentPeriodNetIncome: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  assetAccounts: TrialBalanceDto['rows'];
  liabilityAccounts: TrialBalanceDto['rows'];
  equityAccounts: TrialBalanceDto['rows'];
}

interface CashFlowStatementDto {
  startDate: string;
  endDate: string;
  openingCashBalance: number;
  operatingCashInflows: number;
  operatingCashOutflows: number;
  financingOrOtherNet: number;
  netCashFlow: number;
  endingCashBalance: number;
  breakdown: Array<{ label: string; amount: number; category: string }>;
}

interface SalesMarginReportDto {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalEstimatedCost: number;
  totalGrossProfit: number;
  overallMarginPercent: number;
  byProduct: Array<{
    productId?: string | null;
    sku?: string | null;
    productName: string;
    quantitySold: number;
    revenue: number;
    estimatedCost: number;
    grossProfit: number;
    marginPercent: number;
  }>;
  byStaff: Array<{
    staffName: string;
    documentCount: number;
    totalBeforeVat: number;
    grandTotal: number;
    paidTotal: number;
  }>;
}

interface AccountingPeriodDto {
  year: number;
  month: number;
  periodLabel: string;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  notes?: string | null;
  journalCount: number;
}

const fmt = (v: number, locale: string) =>
  `฿${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ACCOUNT_TYPE_LABEL_KEYS: Record<string, string> = {
  Asset: 'accounting.typeAsset',
  Liability: 'accounting.typeLiability',
  Equity: 'accounting.typeEquity',
  Revenue: 'accounting.typeRevenue',
  Expense: 'accounting.typeExpense',
};

interface ManualLineForm {
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
}

export default function AccountingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SystemAdmin';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yearStartStr = `${now.getFullYear()}-01-01`;

  const [tab, setTab] = useState<'journals' | 'tb' | 'pnl' | 'bs' | 'cf' | 'margin' | 'periods' | 'accounts'>('journals');
  const [accounts, setAccounts] = useState<ChartOfAccountDto[]>([]);
  const [journals, setJournals] = useState<JournalEntryDto[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceDto | null>(null);
  const [pnl, setPnl] = useState<ProfitLossDto | null>(null);

  // Phase 11 States & Filters
  const [bsAsOfDate, setBsAsOfDate] = useState(todayStr);
  const [cfYear, setCfYear] = useState(now.getFullYear());
  const [cfMonth, setCfMonth] = useState(0); // 0 = ทั้งปี
  const [marginStart, setMarginStart] = useState(yearStartStr);
  const [marginEnd, setMarginEnd] = useState(todayStr);
  const [periodsYear, setPeriodsYear] = useState(now.getFullYear());

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetDto | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowStatementDto | null>(null);
  const [salesMargin, setSalesMargin] = useState<SalesMarginReportDto | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriodDto[]>([]);

  const [lockModal, setLockModal] = useState<{
    year: number;
    month: number;
    periodLabel: string;
    currentlyLocked: boolean;
    notes: string;
  } | null>(null);
  const [periodSaving, setPeriodSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [jvModalOpen, setJvModalOpen] = useState(false);
  const [savingJv, setSavingJv] = useState(false);
  const [jvForm, setJvForm] = useState<{
    entryDate: string;
    description: string;
    lines: ManualLineForm[];
  }>({
    entryDate: todayStr,
    description: '',
    lines: [
      { accountId: '', debit: 0, credit: 0, memo: '' },
      { accountId: '', debit: 0, credit: 0, memo: '' },
    ],
  });

  const loadAccountingData = useCallback(async () => {
    const cfQuery = `/accounting/cash-flow?year=${cfYear}${cfMonth > 0 ? `&month=${cfMonth}` : ''}`;
    const [accRes, jRes, tbRes, pnlRes, bsRes, cfRes, marginRes, perRes] = await Promise.all([
      apiClient.get('/accounting/accounts'),
      apiClient.get('/accounting/journals'),
      apiClient.get('/accounting/trial-balance'),
      apiClient.get('/accounting/profit-loss'),
      apiClient.get(`/accounting/balance-sheet?asOfDate=${bsAsOfDate}`),
      apiClient.get(cfQuery),
      apiClient.get(`/accounting/sales-margin?startDate=${marginStart}&endDate=${marginEnd}`),
      apiClient.get(`/accounting/periods?year=${periodsYear}`),
    ]);
    return {
      accounts: (accRes.data?.data ?? []) as ChartOfAccountDto[],
      journals: (jRes.data?.data ?? []) as JournalEntryDto[],
      trialBalance: (tbRes.data?.data ?? null) as TrialBalanceDto | null,
      pnl: (pnlRes.data?.data ?? null) as ProfitLossDto | null,
      balanceSheet: (bsRes.data?.data ?? null) as BalanceSheetDto | null,
      cashFlow: (cfRes.data?.data ?? null) as CashFlowStatementDto | null,
      salesMargin: (marginRes.data?.data ?? null) as SalesMarginReportDto | null,
      periods: (perRes.data?.data ?? []) as AccountingPeriodDto[],
    };
  }, [bsAsOfDate, cfYear, cfMonth, marginStart, marginEnd, periodsYear]);

  const fetchAll = async () => {
    try {
      const result = await loadAccountingData();
      setAccounts(result.accounts);
      setJournals(result.journals);
      setTrialBalance(result.trialBalance);
      setPnl(result.pnl);
      setBalanceSheet(result.balanceSheet);
      setCashFlow(result.cashFlow);
      setSalesMargin(result.salesMargin);
      setPeriods(result.periods);
    } catch (err) {
      console.error('Failed to load accounting data:', err);
    }
  };

  const handleTogglePeriodLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockModal) return;
    setPeriodSaving(true);
    setStatusBanner(null);
    try {
      const endpoint = lockModal.currentlyLocked ? '/accounting/periods/unlock' : '/accounting/periods/lock';
      const res = await apiClient.post(endpoint, {
        year: lockModal.year,
        month: lockModal.month,
        notes: lockModal.notes.trim() || null,
      });
      setStatusBanner({
        type: 'success',
        text: res.data?.message || (lockModal.currentlyLocked ? t('accounting.periodUnlockSuccess') : t('accounting.periodLockSuccess')),
      });
      setLockModal(null);
      await fetchAll();
    } catch (err: unknown) {
      const apiMessage =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setStatusBanner({ type: 'error', text: apiMessage || t('accounting.periodActionError') });
    } finally {
      setPeriodSaving(false);
    }
  };

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
      alert(t('accounting.jvDescRequired'));
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
      alert(t('accounting.jvMinLinesAlert'));
      return;
    }
    const sumDr = validLines.reduce((s, l) => s + l.debit, 0);
    const sumCr = validLines.reduce((s, l) => s + l.credit, 0);
    if (sumDr <= 0 || Math.abs(sumDr - sumCr) >= 0.005) {
      alert(t('accounting.jvBalanceAlert'));
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
      alert(apiMessage || t('accounting.jvSaveError'));
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
        setBalanceSheet(result.balanceSheet);
        setCashFlow(result.cashFlow);
        setSalesMargin(result.salesMargin);
        setPeriods(result.periods);
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
      alert(t('accounting.exportError'));
    }
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full bg-[var(--color-primary)]" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">{t('accounting.title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t('accounting.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openManualJvModal}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus size={15} /> {t('accounting.manualJvBtn')}
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadFile(
                '/accounting/export/excel',
                t('accounting.exportExcelFilename'),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              )
            }
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} /> {t('accounting.exportExcelBtn')}
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadFile(
                `/accounting/export/financial-statements-excel?asOfDate=${bsAsOfDate}&year=${periodsYear}`,
                t('accounting.exportFsFilename', { year: periodsYear }),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              )
            }
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} /> {t('accounting.exportFsBtn')}
          </button>
          <button
            type="button"
            onClick={() => void downloadFile('/accounting/export/csv', 'JournalEntries.csv', 'text/csv;charset=utf-8')}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={15} /> {t('accounting.exportCsvBtn')}
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            statusBanner.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button type="button" onClick={() => setStatusBanner(null)}><X size={16} /></button>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.kpiRevenue')}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(pnl?.totalRevenue ?? 0, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.kpiExpense')}</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(pnl?.totalExpense ?? 0, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.kpiNetProfit')}</p>
          <p className={`text-2xl font-bold mt-1 ${(pnl?.netProfit ?? 0) >= 0 ? 'text-[var(--color-primary)]' : 'text-red-600'}`}>
            {fmt(pnl?.netProfit ?? 0, locale)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('journals')} className={`btn text-xs ${tab === 'journals' ? 'btn-primary' : 'btn-secondary'}`}>
          <BookOpen size={14} /> {t('accounting.tabJournals', { count: journals.length })}
        </button>
        <button type="button" onClick={() => setTab('tb')} className={`btn text-xs ${tab === 'tb' ? 'btn-primary' : 'btn-secondary'}`}>
          <Scale size={14} /> {t('accounting.tabTrialBalance')}
        </button>
        <button type="button" onClick={() => setTab('pnl')} className={`btn text-xs ${tab === 'pnl' ? 'btn-primary' : 'btn-secondary'}`}>
          <TrendingUp size={14} /> {t('accounting.tabPnl')}
        </button>
        <button type="button" onClick={() => setTab('bs')} className={`btn text-xs ${tab === 'bs' ? 'btn-primary' : 'btn-secondary'}`}>
          <Landmark size={14} /> {t('accounting.tabBalanceSheet')}
        </button>
        <button type="button" onClick={() => setTab('cf')} className={`btn text-xs ${tab === 'cf' ? 'btn-primary' : 'btn-secondary'}`}>
          <WalletCards size={14} /> {t('accounting.tabCashFlow')}
        </button>
        <button type="button" onClick={() => setTab('margin')} className={`btn text-xs ${tab === 'margin' ? 'btn-primary' : 'btn-secondary'}`}>
          <PieChart size={14} /> {t('accounting.tabMargin')}
        </button>
        <button type="button" onClick={() => setTab('periods')} className={`btn text-xs ${tab === 'periods' ? 'btn-primary' : 'btn-secondary'}`}>
          <Lock size={14} /> {t('accounting.tabPeriods', { locked: periods.filter((p) => p.isLocked).length })}
        </button>
        <button type="button" onClick={() => setTab('accounts')} className={`btn text-xs ${tab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}>
          <ListTree size={14} /> {t('accounting.tabAccounts', { count: accounts.length })}
        </button>
      </div>

      {tab === 'journals' && (
        <div className="space-y-3">
          {journals.length === 0 ? (
            <div className="card p-8 text-center text-[var(--color-text-muted)]">{t('accounting.emptyJournals')}</div>
          ) : (
            journals.map((j) => (
              <div key={j.id} className="card p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
                  <div>
                    <span className="font-mono font-bold text-sm text-[var(--color-primary)]">{j.journalNumber}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-3">{new Date(j.entryDate).toLocaleDateString(locale)}</span>
                    <span className="text-sm font-medium ml-3">{j.description}</span>
                  </div>
                  <span className="badge badge-info text-[10px]">{j.sourceType} {j.sourceNumber ? `• ${j.sourceNumber}` : ''}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--color-text-muted)]">
                      <th className="text-left py-1">{t('accounting.colAccCode')}</th>
                      <th className="text-left py-1">{t('accounting.colAccName')}</th>
                      <th className="text-right py-1">{t('accounting.colDebitDr')}</th>
                      <th className="text-right py-1">{t('accounting.colCreditCr')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.lines.map((l) => (
                      <tr key={l.id} className="border-t border-[var(--color-border)]/40">
                        <td className="py-1 font-mono">{l.accountCode}</td>
                        <td className="py-1">{l.accountName}</td>
                        <td className="py-1 text-right font-mono">{l.debit > 0 ? fmt(l.debit, locale) : '-'}</td>
                        <td className="py-1 text-right font-mono">{l.credit > 0 ? fmt(l.credit, locale) : '-'}</td>
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
            <span className="font-bold text-sm">{t('accounting.tbTitle')}</span>
            <span className={`badge ${trialBalance.isBalanced ? 'badge-success' : 'badge-danger'}`}>
              {trialBalance.isBalanced ? t('accounting.tbBalanced') : t('accounting.tbUnbalanced')}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('accounting.colAccCode')}</th>
                <th>{t('accounting.colAccName')}</th>
                <th>{t('accounting.colCategory')}</th>
                <th className="text-right">{t('accounting.colDebit')}</th>
                <th className="text-right">{t('accounting.colCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.rows.map((r) => (
                <tr key={r.accountId}>
                  <td className="font-mono text-sm">{r.accountCode}</td>
                  <td className="text-sm">{r.accountName}</td>
                  <td><span className="badge badge-info text-[10px]">{r.accountType}</span></td>
                  <td className="text-right font-mono text-sm">{fmt(r.totalDebit, locale)}</td>
                  <td className="text-right font-mono text-sm">{fmt(r.totalCredit, locale)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-[var(--color-bg-secondary)]">
                <td colSpan={3} className="text-right">{t('accounting.tbTotal')}</td>
                <td className="text-right font-mono">{fmt(trialBalance.totalDebit, locale)}</td>
                <td className="text-right font-mono">{fmt(trialBalance.totalCredit, locale)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pnl' && pnl && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h4 className="font-bold text-emerald-600 border-b border-[var(--color-border)] pb-2">{t('accounting.pnlRevenueSection')}</h4>
            {pnl.revenueAccounts.map((r) => (
              <div key={r.accountId} className="flex justify-between text-sm">
                <span>{r.accountCode} {r.accountName}</span>
                <span className="font-mono font-semibold">{fmt(r.netBalance, locale)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2">
              <span>{t('accounting.pnlTotalRevenue')}</span>
              <span className="font-mono text-emerald-600">{fmt(pnl.totalRevenue, locale)}</span>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h4 className="font-bold text-amber-600 border-b border-[var(--color-border)] pb-2">{t('accounting.pnlExpenseSection')}</h4>
            {pnl.expenseAccounts.map((r) => (
              <div key={r.accountId} className="flex justify-between text-sm">
                <span>{r.accountCode} {r.accountName}</span>
                <span className="font-mono font-semibold">{fmt(r.netBalance, locale)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2">
              <span>{t('accounting.pnlTotalExpense')}</span>
              <span className="font-mono text-amber-600">{fmt(pnl.totalExpense, locale)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="font-bold text-sm">{t('accounting.coaTitle')}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{t('accounting.coaCount', { count: accounts.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('accounting.colAccCode')}</th>
                  <th>{t('accounting.colAccName')}</th>
                  <th>{t('accounting.colCoaCategory')}</th>
                  <th className="text-center">{t('accounting.colCoaType')}</th>
                  <th className="text-center">{t('accounting.colCoaStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[var(--color-text-muted)]">{t('accounting.emptyCoa')}</td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="font-mono font-semibold text-sm text-[var(--color-primary)]">{acc.code}</td>
                      <td className="text-sm">{acc.name}</td>
                      <td>
                        <span className="badge badge-info text-[10px]">
                          {ACCOUNT_TYPE_LABEL_KEYS[acc.accountType] ? t(ACCOUNT_TYPE_LABEL_KEYS[acc.accountType]) : acc.accountType}
                        </span>
                      </td>
                      <td className="text-center text-xs text-[var(--color-text-muted)]">
                        {acc.isSystem ? t('accounting.coaSystem') : t('accounting.coaCustom')}
                      </td>
                      <td className="text-center">
                        <span className={`badge text-[10px] ${acc.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {acc.isActive ? t('accounting.statusActive') : t('accounting.statusInactive')}
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

      {tab === 'bs' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('accounting.bsAsOfDate')}</label>
              <input
                type="date"
                className="input-field w-auto text-sm"
                value={bsAsOfDate}
                onChange={(e) => setBsAsOfDate(e.target.value)}
              />
            </div>
            {balanceSheet && (
              <span className={`badge ${balanceSheet.isBalanced ? 'badge-success' : 'badge-danger'}`}>
                {balanceSheet.isBalanced
                  ? t('accounting.bsBalanced')
                  : t('accounting.bsUnbalanced')}
              </span>
            )}
          </div>

          {balanceSheet && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.bsTotalAssetsCard')}</p>
                  <p className="text-xl font-bold font-mono text-sky-600 mt-1">{fmt(balanceSheet.totalAssets, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.bsTotalLiabCard')}</p>
                  <p className="text-xl font-bold font-mono text-amber-600 mt-1">{fmt(balanceSheet.totalLiabilities, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.bsEquityPlusNiCard')}</p>
                  <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                    {fmt(balanceSheet.totalEquity + balanceSheet.currentPeriodNetIncome, locale)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card p-5 space-y-3">
                  <h4 className="font-bold text-sky-600 border-b border-[var(--color-border)] pb-2">
                    {t('accounting.bsAssetsHeading')}
                  </h4>
                  {balanceSheet.assetAccounts.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] py-3">{t('accounting.bsNoAssets')}</p>
                  ) : (
                    balanceSheet.assetAccounts.map((a) => (
                      <div key={a.accountId} className="flex justify-between text-sm">
                        <span>{a.accountCode} {a.accountName}</span>
                        <span className="font-mono font-semibold">{fmt(a.netBalance, locale)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2 text-sm">
                    <span>{t('accounting.bsTotalAssets')}</span>
                    <span className="font-mono text-sky-600">{fmt(balanceSheet.totalAssets, locale)}</span>
                  </div>
                </div>

                <div className="card p-5 space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-amber-600 border-b border-[var(--color-border)] pb-2">
                      {t('accounting.bsLiabHeading')}
                    </h4>
                    {balanceSheet.liabilityAccounts.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] py-2">{t('accounting.bsNoLiab')}</p>
                    ) : (
                      balanceSheet.liabilityAccounts.map((l) => (
                        <div key={l.accountId} className="flex justify-between text-sm">
                          <span>{l.accountCode} {l.accountName}</span>
                          <span className="font-mono font-semibold">{fmt(l.netBalance, locale)}</span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between font-semibold border-t border-[var(--color-border)] pt-2 text-sm">
                      <span>{t('accounting.bsTotalLiab')}</span>
                      <span className="font-mono text-amber-600">{fmt(balanceSheet.totalLiabilities, locale)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h4 className="font-bold text-emerald-600 border-b border-[var(--color-border)] pb-2">
                      {t('accounting.bsEquityHeading')}
                    </h4>
                    {balanceSheet.equityAccounts.map((eq) => (
                      <div key={eq.accountId} className="flex justify-between text-sm">
                        <span>{eq.accountCode} {eq.accountName}</span>
                        <span className="font-mono font-semibold">{fmt(eq.netBalance, locale)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span>{t('accounting.bsCurrentNetIncome')}</span>
                      <span className="font-mono font-semibold">{fmt(balanceSheet.currentPeriodNetIncome, locale)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2 text-sm">
                      <span>{t('accounting.bsTotalLiabEquity')}</span>
                      <span className="font-mono text-emerald-600">{fmt(balanceSheet.totalLiabilitiesAndEquity, locale)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'cf' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('accounting.cfYearLabel')}</label>
              <input
                type="number"
                className="input-field w-24 text-sm font-mono"
                value={cfYear}
                onChange={(e) => setCfYear(parseInt(e.target.value, 10) || now.getFullYear())}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('accounting.cfMonthLabel')}</label>
              <select
                className="input-field w-36 text-sm"
                value={cfMonth}
                onChange={(e) => setCfMonth(parseInt(e.target.value, 10))}
              >
                <option value={0}>{t('accounting.cfAllYear')}</option>
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleDateString(locale, { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cashFlow && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.cfOpeningCash')}</p>
                  <p className="text-xl font-bold font-mono mt-1">{fmt(cashFlow.openingCashBalance, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.cfOperatingInflow')}</p>
                  <p className="text-xl font-bold font-mono text-emerald-600 mt-1">{fmt(cashFlow.operatingCashInflows, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.cfOperatingOutflow')}</p>
                  <p className="text-xl font-bold font-mono text-amber-600 mt-1">{fmt(cashFlow.operatingCashOutflows, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.cfEndingCash')}</p>
                  <p className="text-xl font-bold font-mono text-[var(--color-primary)] mt-1">{fmt(cashFlow.endingCashBalance, locale)}</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                  <span className="font-bold text-sm">{t('accounting.cfTableTitle')}</span>
                  <span className={`font-mono text-sm font-bold ${cashFlow.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t('accounting.cfNetFlowPrefix')} {cashFlow.netCashFlow >= 0 ? '+' : ''}{fmt(cashFlow.netCashFlow, locale)}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('accounting.cfColItem')}</th>
                      <th>{t('accounting.cfColActivity')}</th>
                      <th className="text-right">{t('accounting.cfColAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-[var(--color-text-muted)]">
                          {t('accounting.cfEmpty')}
                        </td>
                      </tr>
                    ) : (
                      cashFlow.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="text-sm">{b.label}</td>
                          <td><span className="badge badge-info text-[10px]">{b.category}</span></td>
                          <td className={`text-right font-mono text-sm font-semibold ${b.amount >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {fmt(b.amount, locale)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'margin' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('accounting.marginFrom')}</label>
              <input
                type="date"
                className="input-field w-auto text-sm"
                value={marginStart}
                onChange={(e) => setMarginStart(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('accounting.marginTo')}</label>
              <input
                type="date"
                className="input-field w-auto text-sm"
                value={marginEnd}
                onChange={(e) => setMarginEnd(e.target.value)}
              />
            </div>
          </div>

          {salesMargin && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.marginSalesExVat')}</p>
                  <p className="text-xl font-bold font-mono text-sky-600 mt-1">{fmt(salesMargin.totalRevenue, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.marginCogs')}</p>
                  <p className="text-xl font-bold font-mono text-amber-600 mt-1">{fmt(salesMargin.totalEstimatedCost, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.marginGrossProfit')}</p>
                  <p className="text-xl font-bold font-mono text-emerald-600 mt-1">{fmt(salesMargin.totalGrossProfit, locale)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[var(--color-text-muted)]">{t('accounting.marginPercentCard')}</p>
                  <p className="text-xl font-bold font-mono text-[var(--color-primary)] mt-1">
                    {salesMargin.overallMarginPercent.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--color-border)] font-bold text-sm">
                  {t('accounting.marginByProductTitle')}
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>{t('accounting.marginColProduct')}</th>
                        <th className="text-right">{t('accounting.marginColQtySold')}</th>
                        <th className="text-right">{t('accounting.marginColRevenue')}</th>
                        <th className="text-right">{t('accounting.marginColEstCost')}</th>
                        <th className="text-right">{t('accounting.marginColGrossProfit')}</th>
                        <th className="text-right">{t('accounting.marginColPercent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesMargin.byProduct.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">
                            {t('accounting.marginNoProducts')}
                          </td>
                        </tr>
                      ) : (
                        salesMargin.byProduct.map((p, idx) => (
                          <tr key={idx}>
                            <td className="font-mono text-xs">{p.sku || '-'}</td>
                            <td className="text-sm font-medium">{p.productName}</td>
                            <td className="text-right font-mono text-xs">{p.quantitySold.toLocaleString(locale)}</td>
                            <td className="text-right font-mono text-sm">{fmt(p.revenue, locale)}</td>
                            <td className="text-right font-mono text-sm text-[var(--color-text-muted)]">{fmt(p.estimatedCost, locale)}</td>
                            <td className={`text-right font-mono text-sm font-semibold ${p.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {fmt(p.grossProfit, locale)}
                            </td>
                            <td className="text-right font-mono text-xs">{p.marginPercent.toFixed(1)}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--color-border)] font-bold text-sm">
                  {t('accounting.marginByStaffTitle')}
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('accounting.marginColStaff')}</th>
                        <th className="text-right">{t('accounting.marginColDocCount')}</th>
                        <th className="text-right">{t('accounting.marginColBeforeVat')}</th>
                        <th className="text-right">{t('accounting.marginColGrandTotal')}</th>
                        <th className="text-right">{t('accounting.marginColPaidTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesMargin.byStaff.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-[var(--color-text-muted)]">
                            {t('accounting.marginNoStaff')}
                          </td>
                        </tr>
                      ) : (
                        salesMargin.byStaff.map((s, idx) => (
                          <tr key={idx}>
                            <td className="text-sm font-medium">{s.staffName}</td>
                            <td className="text-right font-mono text-sm">{s.documentCount}</td>
                            <td className="text-right font-mono text-sm">{fmt(s.totalBeforeVat, locale)}</td>
                            <td className="text-right font-mono text-sm font-semibold">{fmt(s.grandTotal, locale)}</td>
                            <td className="text-right font-mono text-sm text-emerald-600">{fmt(s.paidTotal, locale)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'periods' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[var(--color-primary)]" size={20} />
              <div>
                <p className="font-semibold text-sm">{t('accounting.periodsHeading')}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t('accounting.periodsDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">{t('accounting.cfYearLabel')}</label>
              <input
                type="number"
                className="input-field w-24 text-sm font-mono"
                value={periodsYear}
                onChange={(e) => setPeriodsYear(parseInt(e.target.value, 10) || now.getFullYear())}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('accounting.periodsColLabel')}</th>
                  <th className="text-center">{t('accounting.periodsColJournals')}</th>
                  <th className="text-center">{t('accounting.periodsColStatus')}</th>
                  <th>{t('accounting.periodsColActor')}</th>
                  <th>{t('accounting.periodsColNotes')}</th>
                  <th className="text-right">{t('accounting.periodsColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={`${p.year}-${p.month}`}>
                    <td className="font-mono font-semibold text-sm">{p.periodLabel}</td>
                    <td className="text-center font-mono text-sm">{p.journalCount}</td>
                    <td className="text-center">
                      {p.isLocked ? (
                        <span className="badge badge-danger text-[10px] inline-flex items-center gap-1">
                          <Lock size={11} /> {t('accounting.periodLockedBadge')}
                        </span>
                      ) : (
                        <span className="badge badge-success text-[10px] inline-flex items-center gap-1">
                          <Unlock size={11} /> {t('accounting.periodOpenBadge')}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                      {p.lockedBy ? `${p.lockedBy} (${p.lockedAt ? new Date(p.lockedAt).toLocaleDateString(locale) : ''})` : '-'}
                    </td>
                    <td className="text-xs">{p.notes || '-'}</td>
                    <td className="text-right">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLockModal({
                              year: p.year,
                              month: p.month,
                              periodLabel: p.periodLabel,
                              currentlyLocked: p.isLocked,
                              notes: p.notes || '',
                            })
                          }
                          className={`btn text-xs py-1 px-2.5 inline-flex items-center gap-1 ${
                            p.isLocked ? 'btn-secondary' : 'btn-primary'
                          }`}
                        >
                          {p.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                          {p.isLocked ? t('accounting.periodUnlockBtn') : t('accounting.periodLockBtn')}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">{t('accounting.periodAdminOnly')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lockModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-base">
                  {lockModal.currentlyLocked
                    ? t('accounting.lockModalUnlockTitle', { period: lockModal.periodLabel })
                    : t('accounting.lockModalLockTitle', { period: lockModal.periodLabel })}
                </h3>
                <button type="button" onClick={() => setLockModal(null)}><X size={18} /></button>
              </div>
              <form onSubmit={(e) => void handleTogglePeriodLock(e)} className="space-y-4">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {lockModal.currentlyLocked
                    ? t('accounting.lockModalUnlockWarn')
                    : t('accounting.lockModalLockWarn')}
                </p>
                <div>
                  <label className="block text-xs font-medium mb-1">{t('accounting.lockNotesLabel')}</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder={t('accounting.lockNotesPlaceholder')}
                    value={lockModal.notes}
                    onChange={(e) => setLockModal({ ...lockModal, notes: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setLockModal(null)} className="btn btn-secondary">{t('accounting.cancelBtn')}</button>
                  <button type="submit" disabled={periodSaving} className="btn btn-primary disabled:opacity-50">
                    {periodSaving ? t('accounting.savingBtn') : lockModal.currentlyLocked ? t('accounting.confirmUnlockBtn') : t('accounting.confirmLockBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Manual Journal Entry Modal */}
      {jvModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg">{t('accounting.jvModalTitle')}</h3>
                <button type="button" onClick={() => setJvModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={(e) => void handleSaveManualJv(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('accounting.jvDateLabel')}</label>
                    <input
                      required
                      type="date"
                      className="input-field"
                      value={jvForm.entryDate}
                      onChange={(e) => setJvForm({ ...jvForm, entryDate: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">{t('accounting.jvDescLabel')}</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder={t('accounting.jvDescPlaceholder')}
                      value={jvForm.description}
                      onChange={(e) => setJvForm({ ...jvForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">{t('accounting.jvLinesHint')}</span>
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
                      <Plus size={14} /> {t('accounting.jvAddLineBtn')}
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
                          <option value="">{t('accounting.jvSelectAccPlaceholder')}</option>
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
                          placeholder={t('accounting.jvDebitPlaceholder')}
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
                          placeholder={t('accounting.jvCreditPlaceholder')}
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
                          placeholder={t('accounting.jvMemoPlaceholder')}
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
                          title={t('accounting.jvRemoveLineTitle')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-bg-secondary)] p-3 text-xs">
                  <div className="flex gap-4 font-mono">
                    <span>{t('accounting.jvTotalDebit')} <strong>{fmt(totalJvDebit, locale)}</strong></span>
                    <span>{t('accounting.jvTotalCredit')} <strong>{fmt(totalJvCredit, locale)}</strong></span>
                  </div>
                  <span className={`badge ${isJvBalanced ? 'badge-success' : 'badge-warning'}`}>
                    {isJvBalanced ? t('accounting.jvBalancedBadge') : t('accounting.jvDiffBadge', { amount: fmt(Math.abs(totalJvDebit - totalJvCredit), locale) })}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setJvModalOpen(false)} className="btn btn-secondary">{t('accounting.cancelBtn')}</button>
                  <button type="submit" disabled={savingJv || !isJvBalanced} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
                    <Save size={16} /> {savingJv ? t('accounting.savingBtn') : t('accounting.jvSaveBtn')}
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

