import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, AlertCircle, RefreshCw, FileText, ArrowLeft } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/useAuthStore';

interface CallbackStatusPayload {
  documentId: string;
  documentNumber: string;
  documentType: string;
  status: string;
  isPaid: boolean;
  grandTotal: number;
  paymentStatus: string;
}

export default function PaymentCallbackPage() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const documentIdParam = searchParams.get('documentId') || '';
  const referenceParam = searchParams.get('reference') || '';
  const chargeIdParam = searchParams.get('chargeId') || searchParams.get('id') || '';

  const [loading, setLoading] = useState(Boolean(documentIdParam || referenceParam || chargeIdParam));
  const [result, setResult] = useState<CallbackStatusPayload | null>(null);
  const [notFound, setNotFound] = useState(!documentIdParam && !referenceParam && !chargeIdParam);

  const loadStatus = useCallback(() => {
    if (!documentIdParam && !referenceParam && !chargeIdParam) {
      return Promise.resolve(null);
    }

    const params = new URLSearchParams();
    if (documentIdParam) params.set('documentId', documentIdParam);
    if (referenceParam) params.set('reference', referenceParam);
    if (chargeIdParam) params.set('chargeId', chargeIdParam);

    return apiClient.get(`/payments/callback-status?${params.toString()}`).then((res) => res.data as CallbackStatusPayload);
  }, [documentIdParam, referenceParam, chargeIdParam]);

  useEffect(() => {
    if (!documentIdParam && !referenceParam && !chargeIdParam) return;
    let active = true;
    loadStatus()
      .then((payload) => {
        if (!active) return;
        if (payload?.documentId) {
          setResult(payload);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [documentIdParam, referenceParam, chargeIdParam, loadStatus]);

  const handleManualRefresh = () => {
    setLoading(true);
    loadStatus()
      .then((payload) => {
        if (payload?.documentId) {
          setResult(payload);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="card max-w-md w-full p-6 sm:p-8 text-center space-y-5">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-6 text-[var(--color-text-muted)]">
            <RefreshCw size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium">{t('paymentCallback.loading')}</p>
          </div>
        ) : notFound || !result ? (
          <div className="space-y-4">
            <AlertCircle size={56} className="mx-auto text-rose-500" />
            <h1 className="text-xl font-bold text-[var(--color-text)]">{t('paymentCallback.missingTitle')}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{t('paymentCallback.missingDesc')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {result.isPaid ? (
              <>
                <CheckCircle2 size={60} className="mx-auto text-emerald-500" />
                <h1 className="text-xl font-bold text-[var(--color-text)]">{t('paymentCallback.paidTitle')}</h1>
                <p className="text-sm text-[var(--color-text-muted)]">{t('paymentCallback.paidDesc')}</p>
              </>
            ) : (
              <>
                <Clock size={60} className="mx-auto text-amber-500" />
                <h1 className="text-xl font-bold text-[var(--color-text)]">{t('paymentCallback.pendingTitle')}</h1>
                <p className="text-sm text-[var(--color-text-muted)]">{t('paymentCallback.pendingDesc')}</p>
              </>
            )}

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">{t('paymentCallback.docNumber')}</span>
                <span className="font-mono font-semibold text-[var(--color-text)]">{result.documentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">{t('paymentCallback.amount')}</span>
                <span className="font-bold tabular-nums text-[var(--color-primary)]">
                  ฿{Number(result.grandTotal || 0).toLocaleString(locale, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">{t('paymentCallback.status')}</span>
                <span className={`font-semibold ${result.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {result.isPaid ? t('paymentCallback.statusPaid') : t('paymentCallback.statusPending')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {!notFound && result && !result.isPaid && (
            <button type="button" onClick={handleManualRefresh} className="btn btn-secondary flex items-center justify-center gap-1.5">
              <RefreshCw size={15} /> {t('paymentCallback.refreshBtn')}
            </button>
          )}
          {result?.documentId && (
            <Link to={`/print/${result.documentId}`} className="btn btn-primary flex items-center justify-center gap-1.5">
              <FileText size={15} /> {t('paymentCallback.viewDocBtn')}
            </Link>
          )}
          <Link to={isAuthenticated ? '/dashboard' : '/login'} className="btn btn-ghost flex items-center justify-center gap-1.5">
            <ArrowLeft size={15} /> {t('paymentCallback.dashboardBtn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

