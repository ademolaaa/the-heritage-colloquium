import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile } from '../../lib/upload';

interface UploadWidgetProps {
  title: string;
  description: string;
  accept?: string;
  s3BucketName?: string;
  passcode: string;
  onUploadComplete?: (item: any) => void;
}

export const UploadWidget: React.FC<UploadWidgetProps> = ({
  title,
  description,
  accept = "*",
  s3BucketName = "heritage-media",
  passcode,
  onUploadComplete
}) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [pending, setPending] = useState<Array<{ file: File; label: string }>>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f && typeof f.name === 'string');
    e.target.value = '';
    if (files.length === 0) return;
    setPending(files.map((file) => ({ file, label: file.name })));
    setUploadStatus('idle');
  };

  const startUpload = async () => {
    if (pending.length === 0) return;
    setUploadStatus('uploading');
    let okCount = 0;
    for (const item of pending) {
      const result = await uploadFile(item.file, passcode, '', item.label);
      if (result.ok) {
        okCount += 1;
        onUploadComplete?.(result.item);
      }
    }
    setUploadStatus(okCount === pending.length ? 'success' : 'error');
    setPending([]);
  };

  return (
    <div className="p-8 md:p-10 border border-white/5 bg-charcoal/50 backdrop-blur-sm relative overflow-hidden group hover:border-gold-500/20 transition-all duration-700">
      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity duration-700">
        <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
      </div>

      <h4 className="text-white font-display mb-3 relative z-10 text-xl tracking-wide">{title}</h4>
      <p className="text-gray-500 text-xs mb-8 relative z-10 leading-relaxed min-h-[40px] font-light max-w-sm">
        {description}
      </p>
      
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex items-center gap-6">
          <label className="relative cursor-pointer group/btn">
             <input 
              type="file" 
              multiple
              className="hidden" 
              accept={accept}
              onChange={handleFileUpload}
              disabled={uploadStatus === 'uploading'}
            />
            <div className={`
              border px-6 py-3 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-3 font-semibold
              ${uploadStatus === 'success' 
                ? 'bg-green-900/10 border-green-500/50 text-green-400 cursor-default' 
                : 'bg-black/50 border-white/10 text-gray-300 group-hover/btn:border-gold-500 group-hover/btn:text-gold-500'
              }
            `}>
              {uploadStatus === 'idle' && (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span>Select Asset</span>
                </>
              )}
              {uploadStatus === 'uploading' && <span className="animate-pulse">Encrypted Upload...</span>}
              {uploadStatus === 'success' && (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Complete</span>
                </>
              )}
            </div>
          </label>
          <div className="flex-1 min-w-0">
            <div
              className="text-gray-600 text-xs font-mono truncate border-b border-transparent group-hover:border-gray-800 transition-colors pb-1"
              title={pending.length > 0 ? pending.map((x) => x.label).join(', ') : undefined}
            >
              {pending.length === 0 ? "Waiting for input..." : pending.length === 1 ? pending[0].label : `${pending.length} files selected`}
            </div>
            {pending.length > 0 && (
              <div className="mt-3 space-y-2">
                {pending.slice(0, 5).map((item, idx) => (
                  <input
                    key={`${item.file.name}-${idx}`}
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-gold-500 focus:outline-none transition-colors font-mono"
                    value={item.label}
                    onChange={(e) =>
                      setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                    }
                    disabled={uploadStatus === 'uploading'}
                  />
                ))}
                {pending.length > 5 && <div className="text-[10px] text-gray-600 font-mono">+{pending.length - 5} more</div>}
                <button
                  type="button"
                  onClick={startUpload}
                  disabled={uploadStatus === 'uploading' || pending.length === 0}
                  className="border border-white/10 bg-black/50 text-gray-300 hover:border-gold-500 hover:text-gold-500 transition-colors text-[10px] uppercase tracking-[0.2em] px-4 py-2 font-semibold"
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="relative h-0.5 bg-white/5 w-full overflow-hidden rounded-full">
          <AnimatePresence>
            {uploadStatus === 'uploading' && (
              <motion.div 
                initial={{ x: "-100%" }} 
                animate={{ x: "0%" }} 
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-500 to-transparent w-full h-full"
              />
            )}
            {uploadStatus === 'success' && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="absolute inset-0 bg-green-500/50 w-full h-full"
              />
            )}
          </AnimatePresence>
        </div>
        
        {uploadStatus === 'success' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex items-center gap-2 text-[10px] text-green-500/70 font-mono"
          >
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
             <span>Secured in bucket: {s3BucketName}</span>
          </motion.div>
        )}
      </div>

      {/* Subtle Background Glow */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gold-500/5 rounded-full blur-3xl z-0 transition-opacity duration-1000 group-hover:opacity-100 opacity-20 pointer-events-none" />
    </div>
  );
};
