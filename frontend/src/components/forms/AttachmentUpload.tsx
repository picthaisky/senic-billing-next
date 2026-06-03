import { useState } from 'react';
import { Paperclip, UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

interface AttachmentUploadProps {
  documentId: string;
  attachments: Attachment[];
  onAttachmentAdded: (attachment: Attachment) => void;
}

export default function AttachmentUpload({ documentId, attachments, onAttachmentAdded }: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // We only process the first file for simplicity in this example
    const file = e.target.files[0];
    
    // Basic validation
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('ขนาดไฟล์ต้องไม่เกิน 10MB');
      return;
    }
    
    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post(`/attachments/upload/${documentId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.success) {
        onAttachmentAdded(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const res = await apiClient.get(`/attachments/download/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Paperclip size={18} /> ไฟล์แนบ (เอกสารอ้างอิง)
        </h3>
      </div>
      
      {error && (
        <div className="mb-4 text-xs font-semibold text-red-500 bg-red-50 p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload Box */}
      <div className="border-2 border-dashed rounded-xl p-6 text-center transition-colors hover:bg-gray-50 relative" style={{ borderColor: 'var(--color-border)' }}>
        <input 
          type="file" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-orange-500 mb-2" />
          ) : (
            <UploadCloud size={32} className="text-gray-400 mb-2" />
          )}
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {uploading ? 'กำลังอัปโหลด...' : 'คลิกหรือลากไฟล์มาวางที่นี่'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            รองรับไฟล์รูปภาพและ PDF ขนาดไม่เกิน 10MB
          </p>
        </div>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mt-4 space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <FileIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold hover:underline cursor-pointer" 
                     style={{ color: 'var(--color-text)' }}
                     onClick={() => handleDownload(att.id, att.fileName)}>
                    {att.fileName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatFileSize(att.fileSize)} • {new Date(att.uploadedAt).toLocaleDateString('th-TH')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
