import { useState, useEffect } from 'react';
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

export default function PaymentModal({ documentId, documentNumber, amount, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  
  const { isConnected } = useAppSystem();

  // Create Charge when modal opens
  useEffect(() => {
    if (isOpen && documentId && !qrCodeUrl && !isPaid) {
      createCharge();
    }
  }, [isOpen, documentId]);

  // Listen to SignalR Event for Payment Success
  useEffect(() => {
    if (!isOpen) return;

    // Use a custom event or callback from signalrClient 
    // In our implementation, we'll register a direct listener to the HubConnection
    const handlePaymentReceived = (data: any) => {
      if (data.documentId === documentId) {
        setIsPaid(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 3000); // close after 3 seconds showing success
      }
    };

    // We can expose the connection from signalrClient to add/remove handlers directly
    const conn = (signalRClient as any).connection;
    if (conn) {
      conn.on('PaymentReceived', handlePaymentReceived);
    }

    return () => {
      if (conn) {
        conn.off('PaymentReceived', handlePaymentReceived);
      }
    };
  }, [isOpen, documentId, onSuccess, onClose]);

  const createCharge = async () => {
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="layout-payment-modal rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative border">
        
        {/* Header */}
        <div className="layout-payment-modal-header p-4 border-b flex justify-between items-center">
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
        <div className="p-6 text-center space-y-6">
          <div>
            <p className="text-[var(--color-text-muted)] text-sm mb-1">หมายเลขเอกสาร</p>
            <p className="font-semibold text-lg">{documentNumber}</p>
          </div>
          
          <div>
            <p className="text-[var(--color-text-muted)] text-sm mb-1">ยอดชำระสุทธิ</p>
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
                <X size={40} className="mx-auto mb-2" />
                <p>{error}</p>
                <button onClick={createCharge} className="mt-4 text-sm underline">ลองใหม่อีกครั้ง</button>
              </div>
            ) : qrCodeUrl ? (
              <div className="flex flex-col items-center gap-2 animate-fade-in">
                <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 rounded-lg shadow-sm bg-white p-2" />
                <div className="flex items-center gap-2 mt-4 text-sm text-[var(--color-text-muted)]">
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
            <div className="flex justify-center pt-2">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/PromptPay_logo.png/600px-PromptPay_logo.png" alt="PromptPay" className="h-8 object-contain opacity-70 grayscale hover:grayscale-0 transition-all" />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
