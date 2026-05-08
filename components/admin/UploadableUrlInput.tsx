import React, { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  accept?: string;
  fieldClass: string;
  labelClass: string;
  passcode: string;
  uploadUrl: string;
  onToast: (text: string) => void;
};

export const UploadableUrlInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  placeholder,
  accept,
  fieldClass,
  labelClass,
  passcode,
  uploadUrl,
  onToast,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; label: string }>>([]);

  const uploadSingleFile = async (file: File, title: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      // Keep original file name but add a unique hash to prevent overwriting
      const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        onToast(uploadError.message);
        return null;
      }

      const { data } = supabase.storage.from('media').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e: any) {
      onToast(e.message || 'Upload failed');
      return null;
    }
  };

  const uploadPending = async () => {
    if (pendingFiles.length === 0) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const item of pendingFiles) {
        const url = await uploadSingleFile(item.file, item.label);
        if (url) uploaded.push(url);
      }
      if (uploaded.length === 0) return;
      onChange(uploaded[0]);
      setPendingFiles([]);
      if (uploaded.length === 1) {
        onToast('Uploaded');
        return;
      }
      try {
        await navigator.clipboard.writeText(uploaded.join('\n'));
        onToast(`Uploaded ${uploaded.length} files (copied URLs)`);
      } catch {
        onToast(`Uploaded ${uploaded.length} files`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-3">
        <input
          className={fieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []).filter((f) => f && typeof f.name === 'string');
            e.target.value = '';
            if (files.length === 0) return;
            setPendingFiles(files.map((file) => ({ file, label: file.name })));
          }}
        />
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Choose
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              onToast('Copied');
            } catch {
              onToast('Copy failed');
            }
          }}
          disabled={!value}
        >
          Copy
        </Button>
      </div>
      {pendingFiles.length > 0 && (
        <div className="mt-3 border border-white/5 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold">
            Selected ({pendingFiles.length})
          </div>
          <div className="space-y-2">
            {pendingFiles.slice(0, 5).map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="flex items-center gap-2">
                <input
                  className="flex-1 bg-black/50 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:border-gold-500 focus:outline-none transition-colors font-serif"
                  value={item.label}
                  onChange={(e) =>
                    setPendingFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                  }
                  disabled={busy}
                />
                <Button
                  variant="outline"
                  className="!py-2 !text-xs"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            ))}
            {pendingFiles.length > 5 && <div className="text-xs text-gray-500">+{pendingFiles.length - 5} more</div>}
            <Button onClick={uploadPending} disabled={busy} className="w-full">
              {busy ? 'Uploading...' : 'Upload Selected'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
