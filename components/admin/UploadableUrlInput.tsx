import React, { useRef, useState } from 'react';
import { Button } from '../ui/Button';

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
    const current = passcode.trim();
    if (!current) {
      onToast('Enter publishing passcode');
      return null;
    }
    if (!uploadUrl) {
      onToast('Uploads not configured');
      return null;
    }
    try {
      const body = new FormData();
      body.append('file', file);
      if (typeof title === 'string' && title.trim()) body.append('title', title.trim());
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'x-admin-passcode': current },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorText = typeof json?.error === 'string' ? json.error : `Upload failed (${res.status})`;
        onToast(errorText);
        return null;
      }
      const item = json?.item || (Array.isArray(json?.items) ? json.items[0] : null);
      const nextUrl = typeof item?.url === 'string' ? item.url : '';
      if (!nextUrl) {
        onToast('Upload failed');
        return null;
      }
      const finalUrl =
        typeof window !== 'undefined' && nextUrl.startsWith('/') ? new URL(nextUrl, window.location.origin).toString() : nextUrl;
      return finalUrl;
    } catch {
      onToast('Upload failed');
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
