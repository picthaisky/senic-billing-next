import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Clock } from 'lucide-react';
import { useAppSystem } from '../../hooks/useAppSystem';
import { signalRClient } from '../../services/signalrClient';
import { apiClient } from '../../services/apiClient';
import axios from 'axios';

interface PaymentModalProps {
  documentId: string;
  documentNumber: string;
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentReceivedEvent = {
  documentId?: string;
};

type SignalRConnectionLike = {
  on: (eventName: string, handler: (data: PaymentReceivedEvent) => void) => void;
  off: (eventName: string, handler: (data: PaymentReceivedEvent) => void) => void;
};

export default function PaymentModal({ documentId, documentNumber, amount, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  
  const { isConnected } = useAppSystem();

  const createCharge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/payments/${documentId}/promptpay`);
      setQrCodeUrl(res.data.qrCodeUrl);
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as string | undefined) || 'ไม่สามารถสร้างรายการชำระเงินได้');
      } else {
        setError('ไม่สามารถสร้างรายการชำระเงินได้');
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Create Charge when modal opens
  useEffect(() => {
    if (isOpen && documentId && !qrCodeUrl && !isPaid) {
      createCharge();
    }
  }, [isOpen, documentId, qrCodeUrl, isPaid, createCharge]);

  // Listen to SignalR Event for Payment Success
  useEffect(() => {
    if (!isOpen) return;

    // Use a custom event or callback from signalrClient 
    // In our implementation, we'll register a direct listener to the HubConnection
    const handlePaymentReceived = (data: PaymentReceivedEvent) => {
      if (data.documentId === documentId) {
        setIsPaid(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 3000); // close after 3 seconds showing success
      }
    };

    // We can expose the connection from signalrClient to add/remove handlers directly
    const conn = (signalRClient as unknown as { connection?: SignalRConnectionLike }).connection;
    if (conn) {
      conn.on('PaymentReceived', handlePaymentReceived);
    }

    return () => {
      if (conn) {
        conn.off('PaymentReceived', handlePaymentReceived);
      }
    };
  }, [isOpen, documentId, onSuccess, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="layout-payment-modal rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative border ">
        
        {/* Header */}
        <div className="layout-payment-modal-header layout-payment-modal-header-shell border-b flex justify-between items-center">
          <h3 className="font-bold text-lg text-[var(--color-primary)]">ชำระเงินออนไลน์ (PromptPay)</h3>
          {!isPaid && (
            <button 
              onClick={onClose} 
              className="layout-payment-modal-close p-1 rounded-full transition-colors text-[var(--color-text-secondary)]" 
              aria-label="ปิดหน้าต่างชำระเงิน"
              title="ปิด"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="form-modal-content form-stack-xl text-center">
          <div>
            <p className="layout-payment-modal-field-label text-[var(--color-text-muted)] text-sm">หมายเลขเอกสาร</p>
            <p className="font-semibold text-lg">{documentNumber}</p>
          </div>
          
          <div>
            <p className="layout-payment-modal-field-label text-[var(--color-text-muted)] text-sm">ยอดชำระสุทธิ</p>
            <p className="text-3xl font-bold text-[var(--color-primary)]">
              ฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="layout-payment-modal-body-surface flex justify-center items-center min-h-[250px] rounded-xl p-4 border">
            {isPaid ? (
              <div className="flex flex-col items-center gap-4 text-green-500 animate-fade-in-up">
                <CheckCircle size={80} className="text-green-500" />
                <h4 className="text-xl font-bold">ชำระเงินเสร็จสมบูรณ์!</h4>
                <p className="text-sm text-[var(--color-text-muted)]">ระบบกำลังอัปเดตสถานะบิล...</p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center gap-4 text-[var(--color-text-muted)]">
                <div className="layout-payment-modal-spinner w-10 h-10 border-4 rounded-full animate-spin"></div>
                <p>กำลังสร้าง QR Code...</p>
              </div>
            ) : error ? (
              <div className="text-red-500">
                <X size={40} className="layout-payment-modal-error-icon" />
                <p>{error}</p>
                <button onClick={createCharge} className="layout-payment-modal-retry text-sm underline">ลองใหม่อีกครั้ง</button>
              </div>
            ) : qrCodeUrl ? (
              <div className="flex flex-col items-center gap-2 animate-fade-in">
                <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 rounded-lg shadow-sm bg-white p-2" />
                <div className="layout-payment-modal-hint flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-green-500"><CheckCircle size={14} /> ระบบกำลังรอการชำระเงิน</span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-500"><Clock size={14} /> ขาดการเชื่อมต่อเซิร์ฟเวอร์ (รีเฟรชอีกครั้งหลังชำระ)</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {!isPaid && (
            <div className="layout-payment-modal-brand-wrap flex justify-center">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/PromptPay_logo.png/600px-PromptPay_logo.png" alt="PromptPay" className="h-8 object-contain opacity-70 grayscale hover:grayscale-0 transition-all" />
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
