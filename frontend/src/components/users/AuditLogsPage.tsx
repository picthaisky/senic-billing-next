import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Download,
  Eye,
  X,
  Users,
  Calendar,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';
import { getApiErrorMessage } from '../../utils/errorUtils';

interface AuditLogItem {
  id: string;
  username: string;
  action: string;
  entityName: string;
  entityId: string;
  oldValues?: string | null;
  newValues?: string | null;
  timestamp: string;
}

interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  distinctUsers: number;
  latestTimestamp?: string | null;
}

interface AuditLogFilters {
  entityNames: string[];
  actions: string[];
}

function formatJsonPreview(raw: string | null | undefined, emptyLabel: string): string {
  if (!raw || !raw.trim()) return emptyLabel;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function getActionBadgeClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('reject') || lower.includes('suspend') || lower.includes('cancel')) {
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  }
  if (lower.includes('create') || lower.includes('add') || lower.includes('approve') || lower.includes('lock') || lower.includes('export')) {
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  }
  if (lower.includes('impersonate') || lower.includes('unlock')) {
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  }
  return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
}

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<AuditLogStats>({
    totalLogs: 0,
    todayLogs: 0,
    distinctUsers: 0,
    latestTimestamp: null,
  });
  const [filters, setFilters] = useState<AuditLogFilters>({ entityNames: [], actions: [] });

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [search, setSearch] = useState('');
  const [entityName, setEntityName] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (entityName) params.set('entityName', entityName);
    if (action) params.set('action', action);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params.toString();
  }, [page, search, entityName, action, fromDate, toDate]);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/audit-logs/filters')
      .then((res) => {
        if (active && res.data?.success && res.data?.data) {
          setFilters(res.data.data as AuditLogFilters);
        }
      })
      .catch(() => {
        // Non-blocking filter metadata fetch
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiClient
      .get(`/audit-logs?${buildQueryParams()}`)
      .then((res) => {
        if (!active) return;
        const data = res.data?.data;
        if (data) {
          setItems(data.items ?? []);
          setTotalCount(data.totalCount ?? 0);
          if (data.stats) setStats(data.stats);
        }
        setError('');
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, '') || '__LOAD_ERROR__');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [buildQueryParams]);

  const handleResetFilters = () => {
    setLoading(true);
    setSearch('');
    setEntityName('');
    setAction('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (entityName) params.set('entityName', entityName);
      if (action) params.set('action', action);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const response = await apiClient.get(`/audit-logs/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(getApiErrorMessage(err, t('auditLogs.exportError')));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2.5">
            <History className="text-[var(--color-primary)]" size={26} />
            {t('auditLogs.title')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t('auditLogs.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Download size={18} />
          {exporting ? t('auditLogs.exporting') : t('auditLogs.exportBtn')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{t('auditLogs.kpiTotal')}</p>
            <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
              {stats.totalLogs.toLocaleString(locale)}
            </p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{t('auditLogs.kpiToday')}</p>
            <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
              {stats.todayLogs.toLocaleString(locale)}
            </p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{t('auditLogs.kpiUsers')}</p>
            <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
              {stats.distinctUsers.toLocaleString(locale)}
            </p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-text-muted)]">{t('auditLogs.kpiLatest')}</p>
            <p className="text-sm font-semibold text-[var(--color-text)] truncate">
              {stats.latestTimestamp
                ? new Date(stats.latestTimestamp).toLocaleString(locale)
                : t('auditLogs.noData')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder={t('auditLogs.searchPlaceholder')}
              className="input-field pl-9"
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            aria-label={t('auditLogs.filterEntityAria')}
            className="input-field"
            value={entityName}
            onChange={(e) => {
              setLoading(true);
              setEntityName(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('auditLogs.allEntities')}</option>
            {filters.entityNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label={t('auditLogs.filterActionAria')}
            className="input-field"
            value={action}
            onChange={(e) => {
              setLoading(true);
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('auditLogs.allActions')}</option>
            {filters.actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label={t('auditLogs.fromDateAria')}
            className="input-field"
            value={fromDate}
            onChange={(e) => {
              setLoading(true);
              setFromDate(e.target.value);
              setPage(1);
            }}
          />

          <div className="flex gap-2">
            <input
              type="date"
              aria-label={t('auditLogs.toDateAria')}
              className="input-field flex-1"
              value={toDate}
              onChange={(e) => {
                setLoading(true);
                setToDate(e.target.value);
                setPage(1);
              }}
            />
            <button
              type="button"
              onClick={handleResetFilters}
              title={t('auditLogs.resetFilters')}
              aria-label={t('auditLogs.resetFilters')}
              className="btn-secondary px-3 shrink-0"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {error === '__LOAD_ERROR__' ? t('auditLogs.loadError') : error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 text-xs font-semibold text-[var(--color-text-secondary)]">
                <th className="py-3.5 px-4">{t('auditLogs.colTimestamp')}</th>
                <th className="py-3.5 px-4">{t('auditLogs.colUsername')}</th>
                <th className="py-3.5 px-4">{t('auditLogs.colAction')}</th>
                <th className="py-3.5 px-4">{t('auditLogs.colEntity')}</th>
                <th className="py-3.5 px-4">{t('auditLogs.colEntityId')}</th>
                <th className="py-3.5 px-4 text-right">{t('auditLogs.colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[var(--color-text-muted)]">
                    {t('auditLogs.loading')}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[var(--color-text-muted)]">
                    {t('auditLogs.empty')}
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--color-surface-hover)]/50 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                      {new Date(log.timestamp).toLocaleString(locale)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--color-text)]">{log.username}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--color-text)]">
                      {log.entityName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--color-text-muted)] max-w-[200px] truncate" title={log.entityId}>
                      {log.entityId}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      >
                        <Eye size={14} />
                        {t('auditLogs.viewDiff')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] text-sm">
          <span className="text-[var(--color-text-muted)]">
            {t('auditLogs.paginationSummary', { total: totalCount.toLocaleString(locale), page, totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft size={16} /> {t('auditLogs.prevBtn')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40 inline-flex items-center gap-1"
            >
              {t('auditLogs.nextBtn')} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden bg-[var(--color-surface-solid)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-bold text-lg text-[var(--color-text)]">
                  {t('auditLogs.modalTitle', { entity: selectedLog.entityName, action: selectedLog.action })}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {t('auditLogs.modalSubtitle', {
                    username: selectedLog.username,
                    timestamp: new Date(selectedLog.timestamp).toLocaleString(locale),
                    entityId: selectedLog.entityId,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label={t('auditLogs.closeAria')}
                className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-2">
                  {t('auditLogs.oldValues')}
                </h3>
                <pre className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs overflow-x-auto max-h-[400px] whitespace-pre-wrap break-all">
                  {formatJsonPreview(selectedLog.oldValues, t('auditLogs.noJson'))}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2">
                  {t('auditLogs.newValues')}
                </h3>
                <pre className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs overflow-x-auto max-h-[400px] whitespace-pre-wrap break-all">
                  {formatJsonPreview(selectedLog.newValues, t('auditLogs.noJson'))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

