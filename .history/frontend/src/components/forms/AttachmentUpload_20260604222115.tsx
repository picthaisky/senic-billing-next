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
    } catch {
      setError('อัปโหลดไฟล์ไม่สำเร็จ');
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
    <div className="card attachment-card-shell">
      <div className="attachment-card-head flex items-center justify-between">
        <h3 className="attachment-card-title font-bold flex items-center gap-2">
          <Paperclip size={18} /> ไฟล์แนบ (เอกสารอ้างอิง)
        </h3>
      </div>
      
      {error && (
        <div className="attachment-error text-xs font-semibold text-red-500 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload Box */}
      <div className="attachment-dropzone border-2 border-dashed rounded-xl text-center transition-colors hover:bg-[var(--color-surface-hover)] relative">
        <input 
          type="file" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          {uploading ? (
            <Loader2 size={32} className="attachment-dropzone-icon animate-spin text-[var(--color-primary)]" />
          ) : (
            <UploadCloud size={32} className="attachment-dropzone-icon text-[var(--color-text-muted)]" />
          )}
          <p className="attachment-dropzone-title font-semibold text-sm">
            {uploading ? 'กำลังอัปโหลด...' : 'คลิกหรือลากไฟล์มาวางที่นี่'}
          </p>
          <p className="attachment-dropzone-subtitle text-xs">
            รองรับไฟล์รูปภาพและ PDF ขนาดไม่เกิน 10MB
          </p>
        </div>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map(att => (
            <div key={att.id} className="attachment-item flex items-center justify-between rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="attachment-item-icon w-10 h-10 rounded-lg flex items-center justify-center">
                  <FileIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold hover:underline cursor-pointer" 
                     className="attachment-item-name"
                     onClick={() => handleDownload(att.id, att.fileName)}>
                    {att.fileName}
                  </p>
                  <p className="attachment-item-meta text-xs">
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
