import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { Plus, Printer, Search, FileText, Edit, Clock, Share2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import DocumentHistoryModal from './DocumentHistoryModal';
import ShareDocumentModal from './ShareDocumentModal';

interface DocumentLine {
  description: string;
  lineTotal: number;
}

interface DocumentHeader {
  id: string;
  documentNumber: string;
  documentDate: string;
  customerName: string;
  grandTotal: number;
  status: string;
  lines: DocumentLine[];
}

export default function DocumentsListPage() {
  const { type } = useParams<{ type: string }>();
  const [documents, setDocuments] = useState<DocumentHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [historyDoc, setHistoryDoc] = useState<{ id: string; num: string } | null>(null);
  const [shareDoc, setShareDoc] = useState<{ id: string; num: string } | null>(null);
  
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SystemAdmin';

  const titles: Record<string, string> = {
    taxinvoice: 'ใบกำกับภาษี',
    receipt: 'ใบเสร็จรับเงิน',
    cashbill: 'บิลเงินสด',
    delivery: 'ใบส่งของ',
    quotation: 'ใบเสนอราคา',
  };

  const title = titles[type || ''] || 'เอกสาร';

  const getEndpoint = (t: string) => {
    switch (t) {
      case 'receipt': return '/receipts';
      case 'cashbill': return '/cashbills';
      case 'delivery': return '/deliveries';
      case 'quotation': return '/quotations';
      case 'taxinvoice': return '/tax-invoices';
      default: return '/documents';
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [type]);

  const fetchDocuments = async (searchQuery = '') => {
    try {
      setLoading(true);
      const res = await apiClient.get(`${getEndpoint(type || '')}?search=${searchQuery}`);
      // Based on PaginatedResponse<DocumentResponse>
      setDocuments(res.data.data?.items || []);
    } catch (error) {
      console.error('Failed to fetch documents', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments(search);
  };

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">ร่าง</span>;
      case 'issued': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">ออกแล้ว</span>;
      case 'sent': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">ส่งแล้ว</span>;
      case 'viewed': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">เปิดอ่านแล้ว</span>;
      case 'paid': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">ชำระแล้ว</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">ยกเลิก</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">รายการ{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            จัดการและดูประวัติ{title}ทั้งหมดของคุณ
          </p>
        </div>
        <Link to={`/documents/${type}/create`} className="btn btn-primary whitespace-nowrap self-start sm:self-auto">
          <Plus size={18} className="mr-1" /> สร้าง{title}
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่เอกสาร หรือชื่อลูกค้า..."
            className="input-field pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e as any);
              }
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm text-left">
            <thead>
              <tr>
                <th className="whitespace-nowrap">วันที่</th>
                <th className="whitespace-nowrap">เลขที่เอกสาร</th>
                <th className="whitespace-nowrap">ลูกค้า</th>
                <th className="text-right whitespace-nowrap">ยอดรวม (บาท)</th>
                <th className="text-center whitespace-nowrap">สถานะ</th>
                <th className="text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2"></div>
                    <p>กำลังโหลดข้อมูล...</p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <FileText size={32} className="mx-auto mb-3 opacity-20" />
                    <p>ไม่พบรายการ{title}</p>
                    {search && <p className="text-xs mt-1 opacity-70">ลองค้นหาด้วยคำอื่น</p>}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[var(--color-bg-secondary)]/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-[var(--color-text)]">
                      {new Date(doc.documentDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-[var(--color-primary)]">
                      {doc.documentNumber}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text)]">
                      <div className="font-medium truncate max-w-[200px]">{doc.customerName || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold tabular-nums text-[var(--color-text)]">
                      {formatNumber(doc.grandTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {(isAdmin || doc.status === 'Draft') && (
                          <button
                            onClick={() => window.open(`/documents/${type || 'receipt'}/edit/${doc.id}`, '_self')}
                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
                            title="แก้ไข"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setShareDoc({ id: doc.id, num: doc.documentNumber })}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="แชร์เอกสาร"
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          onClick={() => setHistoryDoc({ id: doc.id, num: doc.documentNumber })}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                          title="ประวัติการแก้ไข"
                        >
                          <Clock size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`/print/${doc.id}`, '_blank')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="ดู/พิมพ์"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {historyDoc && (
        <DocumentHistoryModal
          documentId={historyDoc.id}
          documentNumber={historyDoc.num}
          onClose={() => setHistoryDoc(null)}
        />
      )}
      {shareDoc && (
        <ShareDocumentModal
          documentId={shareDoc.id}
          documentNumber={shareDoc.num}
          onClose={() => setShareDoc(null)}
        />
      )}
    </div>
  );
}
