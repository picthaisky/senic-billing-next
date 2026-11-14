import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Landmark,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Link2,
  X,
  RefreshCw,
  Search,
  Ban,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';

type BankMatchStatus = 'Unmatched' | 'Suggested' | 'Matched' | 'Ignored';

interface BankStatementTransaction {
  id: string;
  transactionDate: string;
  bankName?: string | null;
  accountNumber?: string | null;
  referenceNo?: string | null;
  description: string;
  counterpartyName?: string | null;
  depositAmount: number;
  withdrawalAmount: number;
  balance?: number | null;
  matchStatus: BankMatchStatus;
  matchedDocumentId?: string | null;
  matchedDocumentNumber?: string | null;
  matchedExpenseId?: string | null;
  matchedExpenseNumber?: string | null;
  matchedAt?: string | null;
  matchedBy?: string | null;
  suggestedDocumentId?: string | null;
  suggestedDocumentNumber?: string | null;
  suggestedCustomerName?: string | null;
  suggestedDocumentAmount?: number | null;
  suggestedExpenseId?: string | null;
  suggestedExpenseNumber?: string | null;
  suggestedVendorName?: string | null;
}

interface BankReconciliationSummary {
  totalTransactions: number;
  matchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  matchedDepositsTotal: number;
  unmatchedDepositsTotal: number;
}

interface ReconciliationDocumentCandidate {
  id: string;
  documentNumber: string;
  documentType: string;
  documentDate: string;
  dueDate?: string | null;
  customerName?: string | null;
  grandTotal: number;
  netReceivable: number;
  status: string;
}

interface ReconciliationExpenseCandidate {
  id: string;
  voucherNumber: string;
  expenseDate: string;
  vendorName: string;
  description: string;
  netPaidAmount: number;
  status: string;
}

const getApiError = (err: unknown, fallback: string) =>
  typeof err === 'object' && err !== null && 'response' in err
    ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback)
    : fallback;

const fmtMoney = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (iso: string | null | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

const STATUS_FILTERS: { id: 'ALL' | BankMatchStatus; labelKey: string }[] = [
  { id: 'ALL', labelKey: 'bankReconciliation.filterAll' },
  { id: 'Suggested', labelKey: 'bankReconciliation.filterSuggested' },
  { id: 'Unmatched', labelKey: 'bankReconciliation.filterUnmatched' },
  { id: 'Matched', labelKey: 'bankReconciliation.filterMatched' },
  { id: 'Ignored', labelKey: 'bankReconciliation.filterIgnored' },
];

export default function BankReconciliationPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const [summary, setSummary] = useState<BankReconciliationSummary>({
    totalTransactions: 0,
    matchedCount: 0,
    suggestedCount: 0,
    unmatchedCount: 0,
    matchedDepositsTotal: 0,
    unmatchedDepositsTotal: 0,
  });
  const [transactions, setTransactions] = useState<BankStatementTransaction[]>([]);
  const [docCandidates, setDocCandidates] = useState<ReconciliationDocumentCandidate[]>([]);
  const [expCandidates, setExpCandidates] = useState<ReconciliationExpenseCandidate[]>([]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | BankMatchStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'csv' | 'manual'>('csv');
  const [importBankName, setImportBankName] = useState('KBANK');
  const [importAccountNo, setImportAccountNo] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [manualTx, setManualTx] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNo: '',
    description: '',
    counterpartyName: '',
    direction: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
  });
  const [importing, setImporting] = useState(false);

  // Manual Match Modal
  const [matchTx, setMatchTx] = useState<BankStatementTransaction | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const [txRes, candRes] = await Promise.all([
        apiClient.get(`/bank-reconciliation/transactions${qs}`),
        apiClient.get('/bank-reconciliation/candidates'),
      ]);
      const txData = txRes.data?.data;
      if (txData?.summary) setSummary(txData.summary);
      setTransactions(txData?.transactions ?? []);
      setDocCandidates(candRes.data?.data?.documents ?? []);
      setExpCandidates(candRes.data?.data?.expenses ?? []);
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, '') || '__LOAD_ERROR__' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAll]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) =>
      [t.description, t.referenceNo, t.counterpartyName, t.bankName, t.matchedDocumentNumber, t.matchedExpenseNumber, t.suggestedDocumentNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [transactions, searchTerm]);

  const filteredCandidates = useMemo(() => {
    if (!matchTx) return { docs: [] as ReconciliationDocumentCandidate[], exps: [] as ReconciliationExpenseCandidate[] };
    const q = candidateSearch.trim().toLowerCase();
    const isDeposit = matchTx.depositAmount > 0;
    if (isDeposit) {
      const docs = docCandidates.filter(
        (d) =>
          !q ||
          d.documentNumber.toLowerCase().includes(q) ||
          (d.customerName ?? '').toLowerCase().includes(q),
      );
      return { docs, exps: [] };
    }
    const exps = expCandidates.filter(
      (e) =>
        !q ||
        e.voucherNumber.toLowerCase().includes(q) ||
        e.vendorName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
    return { docs: [], exps };
  }, [matchTx, candidateSearch, docCandidates, expCandidates]);

  const handleAutoReconcile = async () => {
    setAutoRunning(true);
    setFeedback(null);
    try {
      const res = await apiClient.post('/bank-reconciliation/auto-reconcile');
      const count = res.data?.data?.matchedCount ?? 0;
      setFeedback({
        type: 'success',
        text: res.data?.message || t('bankReconciliation.autoSuccess', { count }),
      });
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, t('bankReconciliation.autoError')) });
    } finally {
      setAutoRunning(false);
    }
  };

  const handleMatch = async (txId: string, payload: { documentId?: string; expenseId?: string }) => {
    setWorkingId(txId);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/bank-reconciliation/transactions/${txId}/match`, payload);
      setFeedback({ type: 'success', text: res.data?.message || t('bankReconciliation.matchSuccess') });
      setMatchTx(null);
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, t('bankReconciliation.matchError')) });
    } finally {
      setWorkingId(null);
    }
  };

  const handleIgnore = async (txId: string) => {
    setWorkingId(txId);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/bank-reconciliation/transactions/${txId}/ignore`);
      setFeedback({ type: 'success', text: res.data?.message || t('bankReconciliation.ignoreSuccess') });
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, t('bankReconciliation.ignoreError')) });
    } finally {
      setWorkingId(null);
    }
  };

  const handleCsvFileUpload = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setCsvContent(text);
  };

  const handleLoadSampleCsv = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstDoc = docCandidates[0];
    const docNum = firstDoc ? firstDoc.documentNumber : 'INV-2026-0001';
    const docAmt = firstDoc ? firstDoc.netReceivable.toFixed(2) : '10700.00';
    const docCust = firstDoc?.customerName || t('bankReconciliation.sampleCustomer');
    setCsvContent(
      `Date,Description,Reference,Deposit,Withdrawal,Balance,Counterparty\n${today},${t('bankReconciliation.sampleDescPrefix')} ${docNum},TRF-${docNum},${docAmt},0,150000.00,${docCust}\n${today},${t('bankReconciliation.sampleFeeDesc')},FEE-001,0,35.00,149965.00,KBANK`,
    );
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setFeedback(null);
    try {
      let payload: Record<string, unknown>;
      if (importMode === 'csv') {
        payload = {
          bankName: importBankName || null,
          accountNumber: importAccountNo || null,
          csvContent,
        };
      } else {
        const amt = parseFloat(manualTx.amount) || 0;
        payload = {
          bankName: importBankName || null,
          accountNumber: importAccountNo || null,
          transactions: [
            {
              transactionDate: `${manualTx.transactionDate}T00:00:00Z`,
              bankName: importBankName || null,
              accountNumber: importAccountNo || null,
              referenceNo: manualTx.referenceNo || null,
              description: manualTx.description || t('bankReconciliation.defaultManualDesc'),
              counterpartyName: manualTx.counterpartyName || null,
              depositAmount: manualTx.direction === 'deposit' ? amt : 0,
              withdrawalAmount: manualTx.direction === 'withdrawal' ? amt : 0,
            },
          ],
        };
      }

      const res = await apiClient.post('/bank-reconciliation/import', payload);
      setFeedback({ type: 'success', text: res.data?.message || t('bankReconciliation.importSuccess') });
      setImportOpen(false);
      setCsvContent('');
      setManualTx({
        transactionDate: new Date().toISOString().split('T')[0],
        referenceNo: '',
        description: '',
        counterpartyName: '',
        direction: 'deposit',
        amount: '',
      });
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, t('bankReconciliation.importError')) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--color-text)]">
            <Landmark className="text-[var(--color-primary)]" size={26} />
            {t('bankReconciliation.title')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t('bankReconciliation.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-1.5"
            title={t('bankReconciliation.refreshTitle')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('bankReconciliation.refreshBtn')}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn btn-secondary flex items-center gap-1.5"
          >
            <Upload size={16} />
            {t('bankReconciliation.importBtn')}
          </button>
          <button
            type="button"
            onClick={() => void handleAutoReconcile()}
            disabled={autoRunning || summary.unmatchedCount === 0}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles size={16} />
            {autoRunning ? t('bankReconciliation.autoRunningBtn') : t('bankReconciliation.autoReconcileBtn')}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.text === '__LOAD_ERROR__' ? t('bankReconciliation.loadError') : feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">{t('bankReconciliation.kpiTotal')}</p>
          <p className="text-2xl font-bold font-mono mt-1">{summary.totalTransactions}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{t('bankReconciliation.kpiTotalUnit')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">{t('bankReconciliation.kpiMatched')}</p>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{summary.matchedCount}</p>
          <p className="text-[11px] text-emerald-600 font-mono mt-1">฿{fmtMoney(summary.matchedDepositsTotal, locale)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">{t('bankReconciliation.kpiSuggested')}</p>
          <p className="text-2xl font-bold font-mono text-sky-600 mt-1">{summary.suggestedCount}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{t('bankReconciliation.kpiSuggestedHint')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">{t('bankReconciliation.kpiUnmatched')}</p>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{summary.unmatchedCount}</p>
          <p className="text-[11px] text-amber-600 font-mono mt-1">฿{fmtMoney(summary.unmatchedDepositsTotal, locale)}</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('bankReconciliation.searchPlaceholder')}
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table table-responsive">
            <thead>
              <tr>
                <th>{t('bankReconciliation.colDate')}</th>
                <th>{t('bankReconciliation.colBankRef')}</th>
                <th>{t('bankReconciliation.colDescCounterparty')}</th>
                <th className="text-right">{t('bankReconciliation.colDeposit')}</th>
                <th className="text-right">{t('bankReconciliation.colWithdrawal')}</th>
                <th>{t('bankReconciliation.colStatusSuggestion')}</th>
                <th className="text-right">{t('bankReconciliation.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[var(--color-text-muted)]">
                    {t('bankReconciliation.loading')}
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[var(--color-text-muted)]">
                    {t('bankReconciliation.empty')}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isBusy = workingId === tx.id;
                  const hasSuggestion = Boolean(tx.suggestedDocumentId || tx.suggestedExpenseId);

                  return (
                    <tr key={tx.id}>
                      <td data-label={t('bankReconciliation.colDate')} className="whitespace-nowrap text-xs font-mono">{fmtDate(tx.transactionDate, locale)}</td>
                      <td data-label={t('bankReconciliation.colBankRef')} className="text-xs">
                        <div className="font-semibold text-[var(--color-text)]">{tx.bankName || t('bankReconciliation.bankFallback')}</div>
                        {tx.referenceNo && (
                          <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{tx.referenceNo}</div>
                        )}
                      </td>
                      <td data-label={t('bankReconciliation.colDescCounterparty')} className="max-w-xs">
                        <div className="text-sm font-medium truncate" title={tx.description}>
                          {tx.description}
                        </div>
                        {tx.counterpartyName && (
                          <div className="text-xs text-[var(--color-text-muted)] truncate">{tx.counterpartyName}</div>
                        )}
                      </td>
                      <td data-label={t('bankReconciliation.colDeposit')} className="text-right font-mono text-sm">
                        {tx.depositAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <ArrowDownLeft size={13} />
                            {fmtMoney(tx.depositAmount, locale)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td data-label={t('bankReconciliation.colWithdrawal')} className="text-right font-mono text-sm">
                        {tx.withdrawalAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <ArrowUpRight size={13} />
                            {fmtMoney(tx.withdrawalAmount, locale)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td data-label={t('bankReconciliation.colStatusSuggestion')}>
                        {tx.matchStatus === 'Matched' ? (
                          <div className="space-y-0.5">
                            <span className="badge badge-success text-[10px]">{t('bankReconciliation.badgeMatched')}</span>
                            <div className="text-xs font-mono font-semibold text-[var(--color-primary)]">
                              {tx.matchedDocumentNumber || tx.matchedExpenseNumber}
                            </div>
                          </div>
                        ) : tx.matchStatus === 'Ignored' ? (
                          <span className="badge text-[10px] bg-slate-500/15 text-slate-500">{t('bankReconciliation.badgeIgnored')}</span>
                        ) : hasSuggestion ? (
                          <div className="space-y-1">
                            <span className="badge badge-info text-[10px]">{t('bankReconciliation.badgeSuggested')}</span>
                            <div className="text-xs">
                              <span className="font-mono font-semibold text-sky-600">
                                {tx.suggestedDocumentNumber || tx.suggestedExpenseNumber}
                              </span>
                              {(tx.suggestedCustomerName || tx.suggestedVendorName) && (
                                <span className="text-[var(--color-text-muted)] ml-1">
                                  ({tx.suggestedCustomerName || tx.suggestedVendorName})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-warning text-[10px]">{t('bankReconciliation.badgeUnmatched')}</span>
                        )}
                      </td>
                      <td data-label={t('bankReconciliation.colActions')} className="text-right whitespace-nowrap">
                        {tx.matchStatus !== 'Matched' && tx.matchStatus !== 'Ignored' && (
                          <div className="inline-flex items-center gap-1.5">
                            {hasSuggestion && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleMatch(tx.id, {
                                    documentId: tx.suggestedDocumentId ?? undefined,
                                    expenseId: tx.suggestedExpenseId ?? undefined,
                                  })
                                }
                                className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} />
                                {t('bankReconciliation.confirmBtn')}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setMatchTx(tx);
                                setCandidateSearch('');
                              }}
                              className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                            >
                              <Link2 size={13} />
                              {t('bankReconciliation.matchBtn')}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleIgnore(tx.id)}
                              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                              title={t('bankReconciliation.ignoreTitle')}
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Bank Statement Modal */}
      {importOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-[var(--color-primary)]" />
                  {t('bankReconciliation.importModalTitle')}
                </h3>
                <button type="button" onClick={() => setImportOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('csv')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                    importMode === 'csv'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {t('bankReconciliation.importTabCsv')}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('manual')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                    importMode === 'manual'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {t('bankReconciliation.importTabManual')}
                </button>
              </div>

              <form onSubmit={(e) => void handleImportSubmit(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('bankReconciliation.bankLabel')}</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={t('bankReconciliation.bankPlaceholder')}
                      value={importBankName}
                      onChange={(e) => setImportBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('bankReconciliation.accountNoLabel')}</label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      placeholder={t('bankReconciliation.accountNoPlaceholder')}
                      value={importAccountNo}
                      onChange={(e) => setImportAccountNo(e.target.value)}
                    />
                  </div>
                </div>

                {importMode === 'csv' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-medium">
                        {t('bankReconciliation.csvLabel')}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadSampleCsv}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {t('bankReconciliation.loadSampleBtn')}
                        </button>
                        <label className="btn btn-secondary text-xs py-1 px-2.5 cursor-pointer">
                          {t('bankReconciliation.chooseCsvBtn')}
                          <input
                            type="file"
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={(e) => void handleCsvFileUpload(e.target.files?.[0])}
                          />
                        </label>
                      </div>
                    </div>
                    <textarea
                      required
                      rows={6}
                      className="input-field font-mono text-xs"
                      placeholder={`Date,Description,Reference,Deposit,Withdrawal,Balance,Counterparty\n2026-11-13,${t('bankReconciliation.sampleDescPrefix')} INV-2026-0001,TRF001,10700.00,0,150000,${t('bankReconciliation.csvPlaceholderExampleCust')}`}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txDateLabel')}</label>
                        <input
                          required
                          type="date"
                          className="input-field"
                          value={manualTx.transactionDate}
                          onChange={(e) => setManualTx({ ...manualTx, transactionDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txRefLabel')}</label>
                        <input
                          type="text"
                          className="input-field font-mono"
                          placeholder="e.g. TRF-20261113-01"
                          value={manualTx.referenceNo}
                          onChange={(e) => setManualTx({ ...manualTx, referenceNo: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txDirectionLabel')}</label>
                        <select
                          className="input-field"
                          value={manualTx.direction}
                          onChange={(e) =>
                            setManualTx({ ...manualTx, direction: e.target.value as 'deposit' | 'withdrawal' })
                          }
                        >
                          <option value="deposit">{t('bankReconciliation.dirDeposit')}</option>
                          <option value="withdrawal">{t('bankReconciliation.dirWithdrawal')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txAmountLabel')}</label>
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="input-field font-mono text-right"
                          value={manualTx.amount}
                          onChange={(e) => setManualTx({ ...manualTx, amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txDescLabel')}</label>
                      <input
                        required
                        type="text"
                        className="input-field"
                        placeholder={t('bankReconciliation.txDescPlaceholder')}
                        value={manualTx.description}
                        onChange={(e) => setManualTx({ ...manualTx, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t('bankReconciliation.txCounterpartyLabel')}</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={t('bankReconciliation.txCounterpartyPlaceholder')}
                        value={manualTx.counterpartyName}
                        onChange={(e) => setManualTx({ ...manualTx, counterpartyName: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setImportOpen(false)} className="btn btn-secondary">
                    {t('bankReconciliation.cancelBtn')}
                  </button>
                  <button type="submit" disabled={importing} className="btn btn-primary disabled:opacity-50">
                    {importing ? t('bankReconciliation.importingBtn') : t('bankReconciliation.importSubmitBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Manual Match Modal */}
      {matchTx &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 className="font-bold text-lg">{t('bankReconciliation.matchModalTitle')}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {fmtDate(matchTx.transactionDate, locale)} • {matchTx.description} •{' '}
                    <strong className="font-mono text-[var(--color-primary)]">
                      {matchTx.depositAmount > 0
                        ? t('bankReconciliation.matchDepositPrefix', { amount: fmtMoney(matchTx.depositAmount, locale) })
                        : t('bankReconciliation.matchWithdrawalPrefix', { amount: fmtMoney(matchTx.withdrawalAmount, locale) })}
                    </strong>
                  </p>
                </div>
                <button type="button" onClick={() => setMatchTx(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  className="input-field pl-9 text-sm"
                  placeholder={t('bankReconciliation.matchSearchPlaceholder')}
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {matchTx.depositAmount > 0 ? (
                  filteredCandidates.docs.length === 0 ? (
                    <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">
                      {t('bankReconciliation.noDocCandidates')}
                    </p>
                  ) : (
                    filteredCandidates.docs.map((doc) => {
                      const exactAmount = Math.abs(doc.netReceivable - matchTx.depositAmount) <= 1;
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3 hover:bg-[var(--color-bg-secondary)]"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[var(--color-primary)]">
                                {doc.documentNumber}
                              </span>
                              {exactAmount && <span className="badge badge-success text-[10px]">{t('bankReconciliation.exactAmountBadge')}</span>}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              {doc.customerName || t('bankReconciliation.generalCustomer')} • {fmtDate(doc.documentDate, locale)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-sm">฿{fmtMoney(doc.netReceivable, locale)}</span>
                            <button
                              type="button"
                              disabled={workingId === matchTx.id}
                              onClick={() => void handleMatch(matchTx.id, { documentId: doc.id })}
                              className="btn btn-primary text-xs py-1.5 px-3"
                            >
                              {t('bankReconciliation.chooseMatchBtn')}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : filteredCandidates.exps.length === 0 ? (
                  <p className="text-center py-6 text-sm text-[var(--color-text-muted)]">
                    {t('bankReconciliation.noExpenseCandidates')}
                  </p>
                ) : (
                  filteredCandidates.exps.map((exp) => {
                    const exactAmount = Math.abs(exp.netPaidAmount - matchTx.withdrawalAmount) <= 1;
                    return (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3 hover:bg-[var(--color-bg-secondary)]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[var(--color-primary)]">
                              {exp.voucherNumber}
                            </span>
                            {exactAmount && <span className="badge badge-success text-[10px]">{t('bankReconciliation.exactAmountBadge')}</span>}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {exp.vendorName} • {exp.description} ({fmtDate(exp.expenseDate, locale)})
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-sm">฿{fmtMoney(exp.netPaidAmount, locale)}</span>
                          <button
                            type="button"
                            disabled={workingId === matchTx.id}
                            onClick={() => void handleMatch(matchTx.id, { expenseId: exp.id })}
                            className="btn btn-primary text-xs py-1.5 px-3"
                          >
                            {t('bankReconciliation.chooseMatchBtn')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

