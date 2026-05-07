import React, { useEffect, useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { MEDIA_CATEGORIES, PROGRAM_CATEGORIES, SYSTEM_CATEGORIES } from '../lib/categories';

const PASSCODE_KEY = 'heritage.admin.passcode';
const REMEMBER_KEY = 'heritage.admin.rememberPasscode';
const AUTOUPLOAD_KEY = 'heritage.admin.autoUpload';

export const AdminUploads: React.FC = () => {
  const [rememberPasscode, setRememberPasscode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const value = window.localStorage.getItem(REMEMBER_KEY);
    return value ? value === '1' : true;
  });
  const [autoUpload, setAutoUpload] = useState(() => {
    if (typeof window === 'undefined') return true;
    const value = window.localStorage.getItem(AUTOUPLOAD_KEY);
    return value ? value === '1' : true;
  });
  const [passcode, setPasscode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(PASSCODE_KEY) || '';
  });
  const [message, setMessage] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; label: string }>>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
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

  const mediaUpdateUrl = useMemo(() => {
    if (!isDev) return '/api/media/update.php';
    if (!v1ApiBaseUrl) return '/api/v1/media'; 
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

  const fieldClass =
    'w-full bg-transparent border border-white/10 px-4 py-3 text-white focus:border-gold-500 focus:outline-none transition-colors font-serif';
  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2400);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REMEMBER_KEY, rememberPasscode ? '1' : '0');
  }, [rememberPasscode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTOUPLOAD_KEY, autoUpload ? '1' : '0');
  }, [autoUpload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (rememberPasscode) window.sessionStorage.setItem(PASSCODE_KEY, passcode);
    else window.sessionStorage.removeItem(PASSCODE_KEY);
  }, [passcode, rememberPasscode]);

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
      for (const item of files) body.append('files[]', item.file);
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
    <Section background="pattern" className="pt-28">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border border-white/5 bg-charcoal/50 p-8">
          <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
            <div>
              <h1 className="font-display text-4xl text-white mb-2">Uploads</h1>
              <p className="text-gray-400 font-light leading-relaxed">
                Drag files in, or choose files. Links appear instantly after upload—copy and paste into any URL field.
              </p>
              {message && <div className="mt-4 text-gold-500 text-xs tracking-widest uppercase">{message}</div>}
            </div>
            <div className="w-full md:max-w-sm space-y-3">
              <div>
                <div className={labelClass}>Admin Passcode</div>
                <input
                  className={fieldClass}
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <label className="flex items-center gap-3 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={autoUpload}
                  onChange={(e) => setAutoUpload(e.target.checked)}
                  className="accent-gold-500"
                />
                Auto-upload after selecting files
              </label>
              <label className="flex items-center gap-3 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={rememberPasscode}
                  onChange={(e) => setRememberPasscode(e.target.checked)}
                  className="accent-gold-500"
                />
                Remember passcode (this tab)
              </label>
              {requireUiGate && passcode.trim() && passcode.trim() !== uiGatePasscode && (
                <div className="text-xs text-red-400">Passcode does not match this site’s admin gate.</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 border border-white/5 bg-charcoal/50 p-8">
            <div className="text-white font-semibold mb-2">Upload</div>
            <div className="text-gray-500 text-sm font-light leading-loose">
              Images, videos, PDFs, Word docs. Multiple files supported.
            </div>
            
            <div className="mb-4 mt-4">
              <div className={labelClass}>Category (Optional)</div>
              <input
                className={fieldClass}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                list="media-categories"
                placeholder="Type a category or pick one"
              />
              <datalist id="media-categories">
                {PROGRAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
                {SYSTEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
                {MEDIA_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div
              className="mt-6 border border-dashed border-white/10 rounded-sm bg-charcoal/30 p-6 text-gray-300"
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
                  className="text-sm text-gray-300"
                  accept="image/*,video/*,application/pdf,.doc,.docx"
                  onChange={(e) => addUploadFiles(e.target.files || [])}
                  disabled={uploadBusy}
                />
                {uploadQueue.length > 0 && (
                  <div className="border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Queued</div>
                    <div className="space-y-2">
                      {uploadQueue.slice(0, 10).map((file, idx) => (
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
                      {uploadQueue.length > 10 && <div className="text-xs text-gray-500">+{uploadQueue.length - 10} more</div>}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  {!autoUpload && (
                    <Button onClick={uploadNow} disabled={uploadBusy || uploadQueue.length === 0 || passcode.trim().length === 0}>
                      {uploadBusy ? 'Uploading…' : 'Upload'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={clearUploads} disabled={uploadBusy}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 border border-white/5 bg-charcoal/50 p-8">
            <div className="text-white font-semibold mb-2">Uploaded Links</div>
            <div className="text-gray-500 text-sm font-light leading-loose">Copy a link and paste it into the admin console.</div>
            <div className="mt-6 space-y-4">
              {uploadedMedia.length === 0 ? (
                <div className="text-sm text-gray-500 font-light">No uploads yet.</div>
              ) : (
                <>
                  {uploadedMedia.slice(0, 12).map((item, idx) => {
                    const url = typeof item?.url === 'string' ? item.url : '';
                    const title = typeof item?.title === 'string' ? item.title : url || 'Upload';
                    const displayUrl = toPublicUrl(url);
                    const isEditing = editingId === item.id;

                    return (
                      <div key={`${item.id}-${idx}`} className="border border-white/5 bg-black/20 p-4">
                        {isEditing ? (
                            <div className="space-y-3 mb-3">
                                <input 
                                    className={fieldClass}
                                    value={editForm.title}
                                    onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Title"
                                />
                                <input
                                  className={fieldClass}
                                  value={editForm.category}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                                  list="media-categories"
                                  placeholder="Category"
                                />
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
                                    <div className="text-white text-sm truncate">{title}</div>
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
                        <div className="mt-1 text-xs text-gray-400 truncate">{displayUrl || url}</div>
                        <div className="mt-3 flex gap-3">
                          <Button variant="outline" onClick={() => copy(displayUrl || url)} disabled={!url}>
                            Copy URL
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.open(displayUrl || url, '_blank', 'noopener,noreferrer')}
                            disabled={!url}
                          >
                            Open
                          </Button>
                          <Button variant="outline" onClick={() => setUploadedMedia((prev) => prev.filter((_, i) => i !== idx))}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {uploadedMedia.length > 12 && <div className="text-xs text-gray-500">+{uploadedMedia.length - 12} more</div>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};
