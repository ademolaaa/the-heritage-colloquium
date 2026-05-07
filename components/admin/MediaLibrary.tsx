import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { MEDIA_CATEGORIES, MediaCategory } from '../../lib/categories';

interface MediaLibraryProps {
  passcode: string;
  setPasscode: (passcode: string) => void;
}

const AUTOUPLOAD_KEY = 'heritage.admin.autoUpload';

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ passcode, setPasscode }) => {
  const [autoUpload, setAutoUpload] = useState(() => {
    if (typeof window === 'undefined') return true;
    const value = window.localStorage.getItem(AUTOUPLOAD_KEY);
    return value ? value === '1' : true;
  });
  
  const [message, setMessage] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; label: string }>>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; category: string }>({ title: '', category: '' });

  const uiGatePasscodeRaw = (import.meta as any).env?.VITE_ADMIN_PASSCODE;
  const uiGatePasscode = typeof uiGatePasscodeRaw === 'string' ? uiGatePasscodeRaw.trim() : '';
  const requireUiGate = Boolean(uiGatePasscode) && uiGatePasscode !== 'change-me';
  const isDev = Boolean((import.meta as any).env?.DEV);
  const v1ApiBaseUrl = (((import.meta as any).env?.VITE_V1_API_BASE_URL as string | undefined) || '').trim();
  const mediaUploadUrl = useMemo(() => {
    if (!isDev) return '/api/media/upload.php';
    if (!v1ApiBaseUrl) return '/api/v1/media/upload';
    try {
      return new URL('/api/v1/media/upload', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/media/upload';
    }
  }, [isDev, v1ApiBaseUrl]);

  const mediaListUrl = useMemo(() => {
    if (!isDev) return '/api/media/index.php';
    if (!v1ApiBaseUrl) return '/api/v1/media';
    try {
      return new URL('/api/v1/media', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/media';
    }
  }, [isDev, v1ApiBaseUrl]);

  const mediaUpdateUrl = useMemo(() => {
    if (!isDev) return '/api/media/update.php';
    if (!v1ApiBaseUrl) return '/api/v1/media'; // Will append /:id
    try {
      return new URL('/api/v1/media', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/media';
    }
  }, [isDev, v1ApiBaseUrl]);

  const updateMedia = async (id: string, updates: { title?: string; category?: string }) => {
    if (!passcode.trim()) return;
    try {
      const isPhp = !isDev;
      const url = isPhp ? mediaUpdateUrl : `${mediaUpdateUrl}/${id.replace('med_', '')}`;
      const method = isPhp ? 'POST' : 'PATCH';
      const body = isPhp ? { id, ...updates } : updates;
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode 
        },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.ok && json.item) {
        setUploadedMedia(prev => prev.map(m => m.id === json.item.id ? json.item : m));
        setEditingId(null);
        setToast('Updated');
      } else {
        setToast('Update failed');
      }
    } catch {
      setToast('Update failed');
    }
  };

  const updateMediaSilently = async (id: string, updates: { title?: string; category?: string }) => {
    if (!passcode.trim()) return null;
    try {
      const isPhp = !isDev;
      const url = isPhp ? mediaUpdateUrl : `${mediaUpdateUrl}/${id.replace('med_', '')}`;
      const method = isPhp ? 'POST' : 'PATCH';
      const body = isPhp ? { id, ...updates } : updates;
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode 
        },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => null);
      return json?.ok && json?.item ? json.item : null;
    } catch {
      return null;
    }
  };

  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';
  const helpClass = 'text-gray-500 text-sm font-light leading-loose';
  const fieldClass = 'w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-gold-500 focus:outline-none transition-colors font-serif';

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2400);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTOUPLOAD_KEY, autoUpload ? '1' : '0');
  }, [autoUpload]);

  useEffect(() => {
    if (!passcode.trim()) return;
    const fetchMedia = async () => {
      try {
        const res = await fetch(`${mediaListUrl}?limit=100`, {
             headers: { 'x-admin-passcode': passcode }
        });
        const json = await res.json();
        if (json.ok && Array.isArray(json.items)) {
            setUploadedMedia(json.items);
        }
      } catch {
        // ignore
      }
    };
    fetchMedia();
  }, [passcode, mediaListUrl]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast('Copied');
    } catch {
      setToast('Copy failed');
    }
  };

  const toPublicUrl = (url: string) => {
    if (typeof url !== 'string' || !url.trim()) return '';
    const value = url.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    const base = v1ApiBaseUrl || (typeof window === 'undefined' ? '' : window.location.origin);
    if (!base) return value;
    try {
      return new URL(value, base).toString();
    } catch {
      return value;
    }
  };

  const uploadFiles = async (files: Array<{ file: File; label: string }>) => {
    const currentPasscode = passcode.trim();
    if (!currentPasscode) {
      setToast('Enter admin passcode');
      return false;
    }
    if (requireUiGate && currentPasscode !== uiGatePasscode) {
      setToast('Invalid passcode');
      return false;
    }
    if (!files || files.length === 0) return false;
    try {
      setUploadBusy(true);
      const body = new FormData();
      for (const item of files) body.append('files', item.file);
      if (selectedCategory) body.append('category', selectedCategory);
      
      const res = await fetch(mediaUploadUrl, {
        method: 'POST',
        headers: { 'x-admin-passcode': currentPasscode },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorText = typeof json?.error === 'string' ? json.error : 'Upload failed';
        setToast(errorText);
        return false;
      }
      const items = Array.isArray(json?.items) ? json.items : json?.item ? [json.item] : [];
      if (items.length === 0) {
        setToast('Upload failed');
        return false;
      }
      const finalItems: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = files[i]?.label?.trim();
        if (!label || typeof item?.id !== 'string') {
          finalItems.push(item);
          continue;
        }
        const updated = await updateMediaSilently(item.id, { title: label });
        finalItems.push(updated || item);
      }
      setUploadedMedia((prev) => [...finalItems, ...prev]);
      setToast(`Uploaded ${finalItems.length} file${finalItems.length === 1 ? '' : 's'}`);
      return true;
    } catch {
      setToast('Upload failed');
      return false;
    } finally {
      setUploadBusy(false);
    }
  };

  const addUploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files || []).filter((f) => f && typeof f.name === 'string');
    if (list.length === 0) return;
    const next = list.map((file) => ({ file, label: file.name }));
    if (autoUpload) {
      void (async () => {
        if (!passcode.trim()) {
          setUploadQueue((prev) => [...prev, ...next]);
          setToast('Enter passcode, then click Upload');
          return;
        }
        const ok = await uploadFiles(next);
        if (!ok) setUploadQueue((prev) => [...prev, ...next]);
      })();
      return;
    }
    setUploadQueue((prev) => [...prev, ...next]);
  };

  const clearUploads = () => {
    setUploadQueue([]);
    setUploadedMedia([]);
    setToast('Cleared');
  };

  const uploadNow = async () => {
    if (uploadQueue.length === 0) {
      setToast('Add files to upload');
      return;
    }
    const ok = await uploadFiles(uploadQueue);
    if (ok) setUploadQueue([]);
  };

  return (
    <details className="border border-white/5 bg-charcoal/50 p-8">
      <summary className="cursor-pointer select-none text-white font-display text-2xl">Media Library</summary>
      
      <div className="flex flex-col md:flex-row justify-between gap-6 mt-6">
        <div className={helpClass}>
          Upload images, videos, or documents. Categorize them for easy filtering.
        </div>
        <div className="w-full md:max-w-xs">
          <div className={labelClass}>Admin Passcode</div>
          <input
            className={fieldClass}
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      {message && <div className="mt-4 text-gold-500 text-xs tracking-widest uppercase">{message}</div>}

      <div className="mt-6 flex flex-col md:flex-row gap-8">
        {/* Upload Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className={labelClass}>Upload</div>
            <label className="flex items-center gap-3 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={autoUpload}
                onChange={(e) => setAutoUpload(e.target.checked)}
                className="accent-gold-500"
              />
              Auto-upload
            </label>
          </div>
          
          <div className="mb-4">
            <div className={labelClass}>Category (Optional)</div>
            <select 
                className={fieldClass}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as MediaCategory)}
            >
                <option value="">-- No Category --</option>
                {MEDIA_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
          </div>

          <div
            className="border border-dashed border-white/10 rounded-sm bg-charcoal/30 p-6 text-gray-300"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addUploadFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex flex-col gap-4">
              <input
                type="file"
                multiple
                className="text-sm text-gray-300 w-full"
                accept="image/*,video/*,application/pdf,.doc,.docx"
                onChange={(e) => addUploadFiles(e.target.files || [])}
                disabled={uploadBusy}
              />
              
              {uploadQueue.length > 0 && (
                <div className="border border-white/5 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Queued</div>
                  <div className="space-y-2">
                    {uploadQueue.slice(0, 5).map((file, idx) => (
                      <div key={`${file.file.name}-${idx}`} className="flex items-center justify-between gap-4">
                        <input
                          className="text-sm text-white/90 truncate bg-transparent outline-none flex-1"
                          value={file.label}
                          onChange={(e) =>
                            setUploadQueue((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                          }
                          disabled={uploadBusy}
                          title={file.label}
                        />
                        <Button
                          variant="outline"
                          onClick={() => setUploadQueue((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={uploadBusy}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {uploadQueue.length > 5 && <div className="text-xs text-gray-500">+{uploadQueue.length - 5} more</div>}
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 flex-wrap">
                {!autoUpload && (
                  <Button onClick={uploadNow} disabled={uploadBusy || uploadQueue.length === 0 || passcode.trim().length === 0}>
                    {uploadBusy ? 'Uploading…' : 'Upload'}
                  </Button>
                )}
                {(uploadQueue.length > 0 || uploadedMedia.length > 0) && (
                  <Button variant="outline" onClick={clearUploads} disabled={uploadBusy}>
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="flex-1">
          <div className={labelClass}>Recent Uploads</div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {uploadedMedia.length === 0 ? (
              <div className="text-sm text-gray-500 font-light border border-white/5 bg-black/20 p-4">
                No uploads in this session.
              </div>
            ) : (
              uploadedMedia.map((item, idx) => {
                const url = typeof item?.url === 'string' ? item.url : '';
                const title = typeof item?.title === 'string' ? item.title : url || 'Upload';
                const displayUrl = toPublicUrl(url);
                const isEditing = editingId === item.id;

                return (
                  <div key={`${item.id}-${idx}`} className="border border-white/5 bg-black/20 p-3">
                    {isEditing ? (
                        <div className="space-y-2 mb-2">
                            <input 
                                className="w-full bg-black/50 border border-white/10 px-2 py-1 text-xs text-white"
                                value={editForm.title}
                                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Title"
                            />
                            <select 
                                className="w-full bg-black/50 border border-white/10 px-2 py-1 text-xs text-white"
                                value={editForm.category}
                                onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                            >
                                <option value="">-- Category --</option>
                                {MEDIA_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <Button 
                                    className="!py-1 !text-xs" 
                                    onClick={() => updateMedia(item.id, { title: editForm.title, category: editForm.category })}
                                >
                                    Save
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="!py-1 !text-xs" 
                                    onClick={() => setEditingId(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2">
                            <div className="flex justify-between items-start">
                                <div className="text-white text-xs font-bold truncate mb-1">{title}</div>
                                <button 
                                    onClick={() => {
                                        setEditingId(item.id);
                                        setEditForm({ title: item.title, category: item.category || '' });
                                    }}
                                    className="text-[10px] text-gold-500 hover:underline uppercase"
                                >
                                    Edit
                                </button>
                            </div>
                            {item.category && (
                                <div className="text-[10px] text-gold-500/80 uppercase tracking-wider mb-1">
                                    {item.category}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 text-xs" onClick={() => copy(displayUrl || url)} disabled={!url}>
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={() => window.open(displayUrl || url, '_blank', 'noopener,noreferrer')}
                        disabled={!url}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </details>
  );
};
