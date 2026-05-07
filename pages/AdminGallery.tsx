import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { GalleryItem, MediaItem } from '../types';

const PASSCODE_KEY = 'heritage.admin.passcode';
const REMEMBER_KEY = 'heritage.admin.rememberPasscode';

export const AdminGallery: React.FC = () => {
  const [rememberPasscode, setRememberPasscode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const value = window.localStorage.getItem(REMEMBER_KEY);
    return value ? value === '1' : true;
  });
  const [passcode, setPasscode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(PASSCODE_KEY) || '';
  });
  const [message, setMessage] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);
  const [mediaMap, setMediaMap] = useState<Record<string, MediaItem>>({});
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  
  const [busy, setBusy] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; label: string }>>([]);
  const [lightboxMediaId, setLightboxMediaId] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [renameTitle, setRenameTitle] = useState('');
  const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);

  const uiGatePasscodeRaw = (import.meta as any).env?.VITE_ADMIN_PASSCODE;
  const uiGatePasscode = typeof uiGatePasscodeRaw === 'string' ? uiGatePasscodeRaw.trim() : '';
  const requireUiGate = Boolean(uiGatePasscode) && uiGatePasscode !== 'change-me';
  const isDev = Boolean((import.meta as any).env?.DEV);
  const v1ApiBaseUrl = (((import.meta as any).env?.VITE_V1_API_BASE_URL as string | undefined) || '').trim();
  const lightboxMedia = lightboxMediaId ? mediaMap[lightboxMediaId] : null;
  
  const galleryListUrl = useMemo(() => {
    if (!isDev) return '/api/gallery/index.php';
    if (!v1ApiBaseUrl) return '/api/v1/gallery';
    try {
      return new URL('/api/v1/gallery', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/gallery';
    }
  }, [isDev, v1ApiBaseUrl]);

  const galleryItemUrl = (id: string) => {
    const safeId = encodeURIComponent(id);
    if (!isDev) return `/api/gallery/item.php?id=${safeId}`;
    if (!v1ApiBaseUrl) return `/api/v1/gallery/${safeId}`;
    try {
      return new URL(`/api/v1/gallery/${safeId}`, v1ApiBaseUrl).toString();
    } catch {
      return `/api/v1/gallery/${safeId}`;
    }
  };

  const mediaApiUrl = useMemo(() => {
    if (!isDev) return '/api/media/index.php';
    if (!v1ApiBaseUrl) return '/api/v1/media';
    try {
      return new URL('/api/v1/media', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/media';
    }
  }, [isDev, v1ApiBaseUrl]);

  const mediaItemUrl = (id: string) => {
    const safeId = encodeURIComponent(id);
    if (!isDev) return `/api/media/item.php?id=${safeId}`;
    if (!v1ApiBaseUrl) return `/api/v1/media/${safeId}`;
    try {
      return new URL(`/api/v1/media/${safeId}`, v1ApiBaseUrl).toString();
    } catch {
      return `/api/v1/media/${safeId}`;
    }
  };

  const uploadUrl = useMemo(() => {
    if (!isDev) return '/api/media/upload.php';
    if (!v1ApiBaseUrl) return '/api/v1/media/upload';
    try {
      return new URL('/api/v1/media/upload', v1ApiBaseUrl).toString();
    } catch {
      return '/api/v1/media/upload';
    }
  }, [isDev, v1ApiBaseUrl]);

  const fieldClass =
    'w-full bg-transparent border border-white/10 px-4 py-3 text-white focus:border-gold-500 focus:outline-none transition-colors font-serif';
  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2400);
  };

  useEffect(() => {
    if (!lightboxMediaId) return;
    const nextTitle = mediaMap[lightboxMediaId]?.title || '';
    setRenameTitle(nextTitle);
    setLightboxZoom(1);
  }, [lightboxMediaId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REMEMBER_KEY, rememberPasscode ? '1' : '0');
  }, [rememberPasscode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (rememberPasscode) window.sessionStorage.setItem(PASSCODE_KEY, passcode);
    else window.sessionStorage.removeItem(PASSCODE_KEY);
  }, [passcode, rememberPasscode]);

  const fetchGalleries = async () => {
    try {
      const res = await fetch(`${galleryListUrl}?limit=100`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.items)) {
        setGalleries(json.items);
      }
    } catch {
      // ignore
    }
  };
  
  const fetchMedia = async (ids: string[]) => {
    // In a real app we might batch fetch or just fetch all media. 
    // For now, let's just fetch all media to populate the map, or fetch individually.
    // Fetching all media might be heavy. Let's fetch recent 100 media or something.
    // Or better, just fetch the media needed for the selected gallery.
    // Since V1 API doesn't support batch get by IDs easily (unless we filter), 
    // we might need to fetch all or loop.
    // Let's assume we can fetch all for now or the gallery response includes media?
    // The gallery item has mediaIds.
    // Let's fetch all media for simplicity in this MVP.
    if (!passcode.trim()) return;
    try {
      const res = await fetch(`${mediaApiUrl}?limit=500`, {
        headers: { 'x-admin-passcode': passcode }
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.items)) {
        const map: Record<string, MediaItem> = {};
        json.items.forEach((m: MediaItem) => {
          map[m.id] = m;
        });
        setMediaMap(map);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGalleries();
    fetchMedia([]); // Pre-load some media
  }, [galleryListUrl, mediaApiUrl, passcode]);

  const createGallery = async () => {
    if (!passcode) {
      setToast('Enter admin passcode');
      return;
    }
    if (!title) {
      setToast('Title is required');
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(galleryListUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode 
        },
        body: JSON.stringify({
          title,
          description,
          year: parseInt(year) || undefined,
          mediaIds: []
        })
      });
      const json = await res.json();
      if (json.ok && json.item) {
        setGalleries(prev => [json.item, ...prev]);
        setSelectedGallery(json.item);
        setTitle('');
        setDescription('');
        setYear('');
        setToast('Gallery created');
      } else {
        setToast(json.error || 'Failed to create');
      }
    } catch {
      setToast('Error creating gallery');
    } finally {
      setBusy(false);
    }
  };

  const updateGallery = async (id: string, updates: Partial<GalleryItem>) => {
    if (!passcode) return;
    try {
      setBusy(true);
      const res = await fetch(galleryItemUrl(id), {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode 
        },
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (json.ok && json.item) {
        setGalleries(prev => prev.map(g => g.id === id ? json.item : g));
        if (selectedGallery?.id === id) setSelectedGallery(json.item);
        setToast('Saved');
      }
    } catch {
      setToast('Error updating');
    } finally {
      setBusy(false);
    }
  };

  const deleteGallery = async (id: string) => {
    const yes = confirm('Are you sure? This does not delete the images, only the gallery.');
    if (!yes) return;
    if (!passcode) return;
    const alsoDeleteMedia = confirm('Also permanently delete all uploaded files in this gallery?');
    try {
      setBusy(true);
      if (alsoDeleteMedia && selectedGallery?.id === id) {
        const ids = Array.isArray(selectedGallery.mediaIds) ? selectedGallery.mediaIds.slice() : [];
        for (const mid of ids) {
          await deleteMedia(mid, { suppressToast: true, skipConfirm: true });
        }
      }
      const res = await fetch(galleryItemUrl(id), {
        method: 'DELETE',
        headers: { 'x-admin-passcode': passcode }
      });
      const json = await res.json();
      if (json.ok) {
        setGalleries(prev => prev.filter(g => g.id !== id));
        if (selectedGallery?.id === id) setSelectedGallery(null);
        setToast('Deleted');
      }
    } catch {
      setToast('Error deleting');
    } finally {
      setBusy(false);
    }
  };

  const deleteMedia = async (mediaId: string, opts?: { suppressToast?: boolean; skipConfirm?: boolean }) => {
    if (!passcode.trim()) {
      if (!opts?.suppressToast) setToast('Enter passcode');
      return;
    }
    if (requireUiGate && passcode.trim() !== uiGatePasscode) {
      if (!opts?.suppressToast) setToast('Invalid passcode');
      return;
    }
    if (!opts?.skipConfirm) {
      const yes = confirm('Permanently delete this file? This removes it from all galleries and deletes it from uploads.');
      if (!yes) return;
    }
    try {
      setBusy(true);
      const res = await fetch(mediaItemUrl(mediaId), {
        method: 'DELETE',
        headers: { 'x-admin-passcode': passcode },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorText = typeof json?.error === 'string' ? json.error : `Delete failed (${res.status})`;
        if (!opts?.suppressToast) setToast(errorText);
        return;
      }

      setMediaMap((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
      setGalleries((prev) =>
        prev.map((g) =>
          Array.isArray(g.mediaIds) && g.mediaIds.includes(mediaId) ? { ...g, mediaIds: g.mediaIds.filter((x) => x !== mediaId) } : g
        )
      );
      setSelectedGallery((prev) =>
        prev && Array.isArray(prev.mediaIds) && prev.mediaIds.includes(mediaId) ? { ...prev, mediaIds: prev.mediaIds.filter((x) => x !== mediaId) } : prev
      );
      if (!opts?.suppressToast) setToast('File deleted');
    } catch {
      if (!opts?.suppressToast) setToast('Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files: Array<{ file: File; label: string }>) => {
    if (!selectedGallery) return;
    if (!passcode) {
      setToast('Enter passcode');
      return;
    }
    if (requireUiGate && passcode.trim() !== uiGatePasscode) {
      setToast('Invalid passcode');
      return;
    }
    try {
      setBusy(true);
      const body = new FormData();
      for (const item of files) body.append('files[]', item.file);
      
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'x-admin-passcode': passcode },
        body
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorText = typeof json?.error === 'string' ? json.error : `Upload failed (${res.status})`;
        setToast(errorText);
        return;
      }
      if (json.ok && json.items) {
        const newMedia = (Array.isArray(json.items) ? json.items : []) as MediaItem[];
        if (newMedia.length === 0) {
          setToast('Upload failed');
          return;
        }
        const renamed: MediaItem[] = [];
        for (let i = 0; i < newMedia.length; i++) {
          const m = newMedia[i];
          const label = files[i]?.label?.trim();
          if (!label || label === m.title) {
            renamed.push(m);
            continue;
          }
          try {
            const renameRes = await fetch(mediaItemUrl(m.id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
              body: JSON.stringify({ title: label }),
            });
            const renameJson = await renameRes.json().catch(() => null);
            if (renameRes.ok && renameJson?.ok && renameJson?.item) renamed.push(renameJson.item as MediaItem);
            else renamed.push(m);
          } catch {
            renamed.push(m);
          }
        }
        // Update media map
        const nextMap = { ...mediaMap };
        renamed.forEach(m => nextMap[m.id] = m);
        setMediaMap(nextMap);
        
        // Add to gallery
        const nextIds = [...(selectedGallery.mediaIds || []), ...renamed.map(m => m.id)];
        await updateGallery(selectedGallery.id, { mediaIds: nextIds });
        setToast(`Uploaded ${renamed.length} files`);
        setUploadQueue([]);
      }
    } catch {
      setToast('Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const openLightbox = (mediaId: string) => {
    setLightboxMediaId(mediaId);
  };

  const closeLightbox = () => {
    setLightboxMediaId(null);
    setLightboxZoom(1);
    setRenameTitle('');
  };

  const saveRename = async () => {
    if (!lightboxMediaId) return;
    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      setToast('Title is required');
      return;
    }
    if (!passcode.trim()) {
      setToast('Enter passcode');
      return;
    }
    if (requireUiGate && passcode.trim() !== uiGatePasscode) {
      setToast('Invalid passcode');
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(mediaItemUrl(lightboxMediaId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify({ title: nextTitle }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.item) {
        const errorText = typeof json?.error === 'string' ? json.error : `Rename failed (${res.status})`;
        setToast(errorText);
        return;
      }
      const updated = json.item as MediaItem;
      setMediaMap((prev) => ({ ...prev, [updated.id]: updated }));
      setToast('Renamed');
    } catch {
      setToast('Rename failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFromGallery = async (mediaId: string) => {
    if (!selectedGallery) return;
    const nextIds = selectedGallery.mediaIds.filter(id => id !== mediaId);
    await updateGallery(selectedGallery.id, { mediaIds: nextIds });
  };

  const addUploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files || []).filter((f) => f && typeof f.name === 'string');
    if (list.length === 0) return;
    setUploadQueue(prev => [...prev, ...list.map((file) => ({ file, label: file.name }))]);
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (busy) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !selectedGallery) return;

    const newMediaIds = [...(selectedGallery.mediaIds || [])];
    const [movedItem] = newMediaIds.splice(draggedIndex, 1);
    newMediaIds.splice(targetIndex, 0, movedItem);

    setDraggedIndex(null);
    setSelectedGallery({ ...selectedGallery, mediaIds: newMediaIds });
    
    // We update the backend
    await updateGallery(selectedGallery.id, { mediaIds: newMediaIds });
  };

  return (
    <Section background="pattern" className="pt-28">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border border-white/5 bg-charcoal/50 p-8">
          <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
            <div>
              <h1 className="font-display text-4xl text-white mb-2">Galleries</h1>
              <p className="text-gray-400 font-light leading-relaxed">
                Create albums and upload photos/videos.
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
                  checked={rememberPasscode}
                  onChange={(e) => setRememberPasscode(e.target.checked)}
                  className="accent-gold-500"
                />
                Remember passcode
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* List / Create */}
          <div className="md:col-span-4 space-y-6">
            <div className="border border-white/5 bg-charcoal/50 p-6">
              <h3 className="text-white font-semibold mb-4">Create New Gallery</h3>
              <div className="space-y-4">
                <input
                  className={fieldClass}
                  placeholder="Gallery Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
                <input
                  className={fieldClass}
                  placeholder="Year (optional)"
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                />
                <textarea
                  className={fieldClass}
                  placeholder="Description (optional)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                <Button onClick={createGallery} disabled={busy || !title} className="w-full">
                  Create Gallery
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {galleries.map(g => (
                <div 
                  key={g.id}
                  onClick={() => setSelectedGallery(g)}
                  className={`p-4 border cursor-pointer transition-colors ${selectedGallery?.id === g.id ? 'border-gold-500 bg-gold-500/10' : 'border-white/5 bg-charcoal/30 hover:bg-charcoal/50'}`}
                >
                  <div className="text-white font-medium">{g.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{g.year || 'No year'} • {g.mediaIds?.length || 0} items</div>
                </div>
              ))}
            </div>
          </div>

          {/* Details / Edit */}
          <div className="md:col-span-8">
            {selectedGallery ? (
              <div className="border border-white/5 bg-charcoal/50 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl text-white font-display">{selectedGallery.title}</h2>
                    <p className="text-gray-400 text-sm mt-1">{selectedGallery.description}</p>
                  </div>
                  <Button variant="outline" onClick={() => deleteGallery(selectedGallery.id)} disabled={busy}>
                    Delete
                  </Button>
                </div>

                <div 
                  className="mb-8 border border-dashed border-white/10 rounded-sm bg-charcoal/30 p-6 text-gray-300"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addUploadFiles(e.dataTransfer.files);
                  }}
                >
                   <div className="flex flex-col gap-4">
                      <p className="text-sm text-center text-gray-400">Drag & Drop images here to upload to this gallery</p>
                      <input
                        type="file"
                        multiple
                        className="text-sm text-gray-300 mx-auto"
                        accept="image/*,video/*"
                        onChange={(e) => addUploadFiles(e.target.files || [])}
                        disabled={busy}
                      />
                      {uploadQueue.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs uppercase tracking-widest text-gold-500 mb-2">{uploadQueue.length} files queued</div>
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {uploadQueue.slice(0, 10).map((item, idx) => (
                              <div key={`${item.file.name}-${idx}`} className="flex items-center justify-between gap-3 border border-white/5 bg-black/20 px-3 py-2">
                                <input
                                  className="flex-1 bg-transparent outline-none text-xs text-gray-300 truncate"
                                  value={item.label}
                                  onChange={(e) =>
                                    setUploadQueue((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                                  }
                                  disabled={busy}
                                  title={item.label}
                                />
                                <Button
                                  variant="outline"
                                  className="!py-1 !text-xs"
                                  onClick={() => setUploadQueue((prev) => prev.filter((_, i) => i !== idx))}
                                  disabled={busy}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                            {uploadQueue.length > 10 && (
                              <div className="text-xs text-gray-500">+{uploadQueue.length - 10} more</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => uploadFiles(uploadQueue)} disabled={busy}>Upload All</Button>
                            <Button variant="outline" onClick={() => setUploadQueue([])}>Clear</Button>
                          </div>
                        </div>
                      )}
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedGallery.mediaIds?.map((mid, index) => {
                    const m = mediaMap[mid];
                    if (!m) return null;
                    return (
                      <div 
                        key={mid} 
                        className={`relative group border border-white/10 bg-black/40 transition-opacity ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => openLightbox(mid)}
                        style={{ cursor: 'move' }}
                      >
                        {m.type === 'image' ? (
                          <img src={m.url} alt={m.title} className="w-full aspect-square object-cover" />
                        ) : m.type === 'video' ? (
                          <video src={m.url} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center text-gray-500 bg-white/5">
                            {m.type}
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeFromGallery(mid);
                          }}
                          className="absolute top-2 right-2 bg-red-500/80 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Remove
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteMedia(mid);
                          }}
                          className="absolute top-2 left-2 bg-red-500/80 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </button>
                        <div className="p-2 truncate text-xs text-gray-400">{m.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 border border-white/5 bg-charcoal/30">
                Select a gallery to manage
              </div>
            )}
          </div>
        </div>
      </div>
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 md:p-10"
          onClick={closeLightbox}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="text-white text-sm truncate">{lightboxMedia.title}</div>
              <div className="flex items-center gap-2">
                {lightboxMedia.type === 'image' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setLightboxZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                      disabled={lightboxZoom <= 1}
                    >
                      -
                    </Button>
                    <Button variant="outline" onClick={() => setLightboxZoom(1)} disabled={lightboxZoom === 1}>
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLightboxZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                      disabled={lightboxZoom >= 4}
                    >
                      +
                    </Button>
                  </>
                )}
                {lightboxMedia.type === 'video' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const el = lightboxVideoRef.current;
                      if (!el) return;
                      const anyEl = el as any;
                      if (typeof anyEl.requestFullscreen === 'function') anyEl.requestFullscreen();
                    }}
                  >
                    Fullscreen
                  </Button>
                )}
                <Button variant="outline" onClick={closeLightbox}>
                  Close
                </Button>
              </div>
            </div>

            <div className="border border-white/10 bg-black/40 overflow-auto max-h-[70vh] flex items-center justify-center">
              {lightboxMedia.type === 'video' ? (
                <video ref={lightboxVideoRef} src={lightboxMedia.url} controls className="max-w-full max-h-[70vh]" />
              ) : (
                <img
                  src={lightboxMedia.url}
                  alt={lightboxMedia.title}
                  className="max-w-full max-h-[70vh] object-contain"
                  style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center' }}
                />
              )}
            </div>

            <div className="mt-4 border border-white/10 bg-black/30 p-4">
              <div className={labelClass}>Rename</div>
              <div className="flex gap-2">
                <input
                  className={fieldClass}
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                />
                <Button onClick={saveRename} disabled={busy || !renameTitle.trim()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
};
