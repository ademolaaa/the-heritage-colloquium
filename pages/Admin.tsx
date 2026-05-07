import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { UploadableUrlInput } from '../components/admin/UploadableUrlInput';
import { useSiteContent } from '../components/SiteContentProvider';
import { DEFAULT_SITE_CONTENT } from '../data/defaultContent';
import { placeholderImageDataUri } from '../lib/placeholders';
import { fetchRemoteContent, publishRemoteContent } from '../lib/remoteContent';
import { mergeWithDefaults } from '../lib/siteContentStore';
import { DownloadItem, Lecture, PastSpeaker, SponsorTier, BlogPost, LeadershipMember } from '../types';

const SESSION_KEY = 'heritage.admin.unlocked';
const PASSCODE_KEY = 'heritage.admin.passcode';
const REMEMBER_KEY = 'heritage.admin.rememberPasscode';

import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { content, setContent, resetToDefaults, exportJson, importJson } = useSiteContent();
  const [passcode, setPasscode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(PASSCODE_KEY) || 'change-me';
  });
  const [message, setMessage] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false); // For bulk uploads
  const [bulkResourceNames, setBulkResourceNames] = useState<string[]>([]);
  
  // Autosave state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastSavedContentRef = useRef<string>('');

  const uiGatePasscodeRaw = (import.meta as any).env?.VITE_ADMIN_PASSCODE;
  const uiGatePasscode = typeof uiGatePasscodeRaw === 'string' ? uiGatePasscodeRaw.trim() : '';
  const requireUiGate = Boolean(uiGatePasscode) && uiGatePasscode !== 'change-me';
  const isDev = Boolean((import.meta as any).env?.DEV);
  const readUrl =
    ((import.meta as any).env?.VITE_CONTENT_READ_URL as string | undefined) || (isDev ? '/api/content' : '/api/content.php');
  const writeUrl =
    ((import.meta as any).env?.VITE_CONTENT_WRITE_URL as string | undefined) || (isDev ? '/api/content' : '/api/content.php');
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

  const unlocked = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  }, []);

  const [isUnlocked, setIsUnlocked] = useState(unlocked);

  const fieldClass =
    'w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-gold-500 focus:outline-none transition-colors font-serif';

  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';
  const helpClass = 'text-gray-500 text-sm font-light leading-loose';
  const defaultNavPaths = useMemo(() => new Set(DEFAULT_SITE_CONTENT.nav.map((x) => x.path)), []);
  const navPathSuggestions = useMemo(() => DEFAULT_SITE_CONTENT.nav.map((x) => x.path), []);

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2400);
  };

  useEffect(() => {
    // Auto-unlock if using default passcode and no UI gate
    if (!isUnlocked && passcode === 'change-me' && !requireUiGate) {
      window.sessionStorage.setItem(SESSION_KEY, '1');
      setIsUnlocked(true);
    }
  }, [isUnlocked, passcode, requireUiGate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rememberRaw = window.localStorage.getItem(REMEMBER_KEY);
    const remember = rememberRaw ? rememberRaw === '1' : true;
    if (remember) window.sessionStorage.setItem(PASSCODE_KEY, passcode);
    else window.sessionStorage.removeItem(PASSCODE_KEY);
  }, [passcode]);

  const requireUnlock = () => {
    const value = passcode.trim();
    if (!value) {
      setToast('Enter passcode');
      return;
    }
    if (requireUiGate && value !== uiGatePasscode) {
      setToast('Invalid passcode');
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, '1');
    setIsUnlocked(true);
    setToast('Admin unlocked');
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast('Copied');
    } catch {
      setToast('Copy failed');
    }
  };

  // Initial Pull on Unlock
  useEffect(() => {
    if (isUnlocked && readUrl) {
      void (async () => {
        try {
          const payload = await fetchRemoteContent(readUrl);
          const remote = extractRemoteContent(payload);
          if (remote) {
            const merged = mergeWithDefaults(DEFAULT_SITE_CONTENT, remote);
            setContent(merged);
            lastSavedContentRef.current = JSON.stringify(merged);
          }
        } catch {
          // Silent fail on initial load if no content
        }
      })();
    }
  }, [isUnlocked, readUrl]);

  // Auto-Save Logic
  useEffect(() => {
    if (!isUnlocked || !writeUrl || !passcode) return;

    // Skip if content matches last saved
    const currentJson = JSON.stringify(content);
    if (currentJson === lastSavedContentRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    setIsAutoSaving(true);
    autoSaveTimerRef.current = window.setTimeout(async () => {
      try {
        await publishRemoteContent(writeUrl, content, passcode);
        lastSavedContentRef.current = currentJson;
        setToast('Saved');
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : 'Auto-save failed';
        setToast(msg);
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, isUnlocked, writeUrl, passcode]);


  // Helper to safely extract remote content
  const extractRemoteContent = (payload: any) => {
    if (!payload) return null;
    if (payload.content && typeof payload.content === 'object') return payload.content;
    return payload;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleBulkUploadDownloads = async (files: FileList | File[] | null) => {
    if (!passcode) {
      setToast('Enter admin passcode');
      return;
    }
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    try {
      setUploadBusy(true);
      const body = new FormData();
      for (const file of fileList) body.append('files[]', file);

      const res = await fetch(mediaUploadUrl, {
        method: 'POST',
        headers: { 'x-admin-passcode': passcode },
        body,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setToast(json?.error || 'Upload failed');
        return;
      }

      const items = Array.isArray(json?.items) ? json.items : (json?.item ? [json.item] : []);
      if (items.length === 0) {
        setToast('No files returned');
        return;
      }

      const newDownloads: DownloadItem[] = items.map((item: any) => {
        const fileUrl = typeof item?.url === 'string' ? item.url : '';
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : (v1ApiBaseUrl ? new URL(fileUrl, v1ApiBaseUrl).toString() : fileUrl);
        return {
          id: 'dl_' + (item.id || '').replace('med_', '') + '_' + Math.random().toString(36).substr(2, 5),
          title: item.title || 'Untitled',
          category: 'General',
          size: formatFileSize(item.sizeBytes || 0),
          type: (item.mimeType === 'application/pdf' ? 'PDF' : (item.filePath || '').split('.').pop()?.toUpperCase() || 'FILE'),
          url: fullUrl
        };
      });

      setContent((c) => ({
        ...c,
        downloads: [...newDownloads, ...c.downloads]
      }));
      
      // Force immediate save to ensure it persists
      try {
        await publishRemoteContent(writeUrl, {
          ...content,
          downloads: [...newDownloads, ...content.downloads]
        }, passcode);
        setToast(`Uploaded & Saved ${newDownloads.length} files`);
      } catch (e) {
        setToast('Uploaded but save failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      setToast('Error uploading files');
    } finally {
      setUploadBusy(false);
    }
  };

  if (!isUnlocked) {
    return (
      <Section background="darker" className="pt-40">
        <div className="max-w-xl mx-auto border border-white/5 bg-charcoal/60 backdrop-blur-sm p-12">
          <h1 className="font-display text-4xl text-white mb-4">Admin</h1>
          <p className="text-gray-400 mb-10 leading-relaxed font-light">
            Enter your admin passcode to edit site content.
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Admin Passcode</label>
              <input
                className={fieldClass}
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button className="w-full" onClick={requireUnlock}>
              Unlock
            </Button>
            {message && <div className="text-gold-500 text-xs tracking-widest uppercase">{message}</div>}
          </div>
        </div>
      </Section>
    );
  }

  return (
    <>
      <div className="pt-36 pb-16 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
            <div>
              <h1 className="font-display text-5xl text-white mb-3">Admin Console</h1>
              <div className="flex items-center gap-3">
                 <p className="text-gray-400 font-light max-w-3xl leading-relaxed">
                   Changes are saved automatically as you edit.
                 </p>
                 {isAutoSaving && <span className="text-gold-500 text-xs uppercase tracking-widest animate-pulse">Saving...</span>}
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="border border-white/5 bg-black/20 p-5">
                  <div className="text-white font-semibold mb-1">1) Edit</div>
                  <div className="text-gray-500 font-light leading-relaxed">Open a section below and update the fields.</div>
                </div>
                <div className="border border-white/5 bg-black/20 p-5">
                  <div className="text-white font-semibold mb-1">2) Upload media</div>
                  <div className="text-gray-500 font-light leading-relaxed">Use Upload buttons (or the Uploads page) to get a link.</div>
                </div>
              </div>
              {message && <div className="mt-4 text-gold-500 text-xs tracking-widest uppercase">{message}</div>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/admin/gallery')}>
                Galleries
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/uploads')}>
                Uploads
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetToDefaults();
                  setToast('Reset to defaults');
                }}
              >
                Reset
              </Button>
            </div>
          </div>
          
          {writeUrl && (
            <div className="hidden">
              {/* Passcode change moved to dedicated page: /admin/change-passcode */}
            </div>
          )}

          <details className="mt-12 border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Global Background</summary>
            <div className={`mt-4 ${helpClass}`}>Set a background image or video that appears across the entire site.</div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Background Type</label>
                <select
                  className={fieldClass}
                  value={content.globalBackground?.type || 'none'}
                  onChange={(e) =>
                    setContent((c) => ({
                      ...c,
                      globalBackground: {
                        ...(c.globalBackground || { imageUrl: '', videoUrl: '', opacity: 0.3 }),
                        type: e.target.value as any,
                      },
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Overlay Opacity (0.0 - 1.0)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className={fieldClass}
                  value={content.globalBackground?.opacity ?? 0.3}
                  onChange={(e) =>
                    setContent((c) => ({
                      ...c,
                      globalBackground: {
                        ...(c.globalBackground || { type: 'none', imageUrl: '', videoUrl: '' }),
                        opacity: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-4">
                {(content.globalBackground?.type === 'image' || content.globalBackground?.type === 'video') && (
                  <UploadableUrlInput
                    label="Background Image URL"
                    value={content.globalBackground?.imageUrl || ''}
                    onChange={(next) =>
                      setContent((c) => ({
                        ...c,
                        globalBackground: {
                          ...(c.globalBackground || { type: 'image', videoUrl: '', opacity: 0.3 }),
                          imageUrl: next,
                        },
                      }))
                    }
                    placeholder="https://..."
                    accept="image/*"
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    passcode={passcode}
                    uploadUrl={mediaUploadUrl}
                    onToast={setToast}
                  />
                )}
                {content.globalBackground?.type === 'video' && (
                  <UploadableUrlInput
                    label="Background Video URL (mp4/webm)"
                    value={content.globalBackground?.videoUrl || ''}
                    onChange={(next) =>
                      setContent((c) => ({
                        ...c,
                        globalBackground: {
                          ...(c.globalBackground || { type: 'video', imageUrl: '', opacity: 0.3 }),
                          videoUrl: next,
                        },
                      }))
                    }
                    placeholder="https://..."
                    accept="video/*"
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    passcode={passcode}
                    uploadUrl={mediaUploadUrl}
                    onToast={setToast}
                  />
                )}
              </div>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Brand</summary>
            <div className={`mt-4 ${helpClass}`}>Set the site name, tagline, and logo.</div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Wordmark</label>
                <input
                  className={fieldClass}
                  value={content.brand.wordmark}
                  onChange={(e) => setContent((c) => ({ ...c, brand: { ...c.brand, wordmark: e.target.value } }))}
                />
              </div>
              <div>
                <label className={labelClass}>Tagline</label>
                <input
                  className={fieldClass}
                  value={content.brand.tagline}
                  onChange={(e) => setContent((c) => ({ ...c, brand: { ...c.brand, tagline: e.target.value } }))}
                />
              </div>
              <div>
                <UploadableUrlInput
                  label="Logo URL"
                  value={content.brand.logoUrl}
                  onChange={(next) => setContent((c) => ({ ...c, brand: { ...c.brand, logoUrl: next } }))}
                  placeholder="https://..."
                  accept="image/*"
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                  passcode={passcode}
                  uploadUrl={mediaUploadUrl}
                  onToast={setToast}
                />
              </div>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Navigation</summary>
            <div className={`mt-4 ${helpClass}`}>Edit the top navigation links (label + page path).</div>
            <div className="mt-8 space-y-4">
              {content.nav.map((item, idx) => (
                <div
                  key={`${item.path}-${idx}`}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 border border-white/5 p-6 ${item.hidden ? 'opacity-60' : ''}`}
                >
                  <div className="md:col-span-4">
                    <label className={labelClass}>Label</label>
                    <input
                      className={fieldClass}
                      value={item.label}
                      onChange={(e) =>
                        setContent((c) => {
                          const next = [...c.nav];
                          next[idx] = { ...next[idx], label: e.target.value };
                          return { ...c, nav: next };
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelClass}>Path</label>
                    <div className="relative">
                      <input
                        className={fieldClass}
                        value={item.path}
                        list={`nav-suggestions-${idx}`}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.nav];
                            next[idx] = { ...next[idx], path: e.target.value };
                            return { ...c, nav: next };
                          })
                        }
                      />
                      <datalist id={`nav-suggestions-${idx}`}>
                        {navPathSuggestions.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="md:col-span-4 flex items-end gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!item.hidden}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.nav];
                            next[idx] = { ...next[idx], hidden: !e.target.checked };
                            return { ...c, nav: next };
                          })
                        }
                        className="accent-gold-500"
                      />
                      Visible
                    </label>
                    {!defaultNavPaths.has(item.path) && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          setContent((c) => {
                            const next = [...c.nav];
                            next.splice(idx, 1);
                            return { ...c, nav: next };
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    nav: [...c.nav, { label: 'New Link', path: '/', hidden: true }],
                  }))
                }
              >
                Add Link
              </Button>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Footer Navigation</summary>
            <div className={`mt-4 ${helpClass}`}>Edit the footer navigation links.</div>
            <div className="mt-8 space-y-4">
              {(content.footerNav || []).map((item, idx) => (
                <div
                  key={`${item.path}-${idx}`}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 border border-white/5 p-6 ${item.hidden ? 'opacity-60' : ''}`}
                >
                  <div className="md:col-span-4">
                    <label className={labelClass}>Label</label>
                    <input
                      className={fieldClass}
                      value={item.label}
                      onChange={(e) =>
                        setContent((c) => {
                          const next = [...(c.footerNav || [])];
                          next[idx] = { ...next[idx], label: e.target.value };
                          return { ...c, footerNav: next };
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelClass}>Path</label>
                    <div className="relative">
                      <input
                        className={fieldClass}
                        value={item.path}
                        list={`footer-nav-suggestions-${idx}`}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...(c.footerNav || [])];
                            next[idx] = { ...next[idx], path: e.target.value };
                            return { ...c, footerNav: next };
                          })
                        }
                      />
                      <datalist id={`footer-nav-suggestions-${idx}`}>
                        {navPathSuggestions.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="md:col-span-4 flex items-end gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!item.hidden}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...(c.footerNav || [])];
                            next[idx] = { ...next[idx], hidden: !e.target.checked };
                            return { ...c, footerNav: next };
                          })
                        }
                        className="accent-gold-500"
                      />
                      Visible
                    </label>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setContent((c) => {
                          const next = [...(c.footerNav || [])];
                          next.splice(idx, 1);
                          return { ...c, footerNav: next };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    footerNav: [...(c.footerNav || []), { label: 'New Link', path: '/', hidden: true }],
                  }))
                }
              >
                Add Footer Link
              </Button>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Home Page</summary>
            <div className={`mt-4 ${helpClass}`}>Edit the hero section, mandate, and announcements.</div>
            <div className="mt-8 space-y-8">
              <div className="border border-white/5 p-6 bg-black/20">
                <h3 className="text-white font-semibold mb-4">Hero Section</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Kicker (Small Top Text)</label>
                    <input
                      className={fieldClass}
                      value={content.home.heroKicker}
                      onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heroKicker: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Title Line 1</label>
                    <input
                      className={fieldClass}
                      value={content.home.heroTitleLine1}
                      onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heroTitleLine1: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Emphasis Title</label>
                    <input
                      className={fieldClass}
                      value={content.home.heroTitleEmphasis}
                      onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heroTitleEmphasis: e.target.value } }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Quote</label>
                    <textarea
                      className={fieldClass}
                      value={content.home.heroQuote}
                      onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heroQuote: e.target.value } }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <UploadableUrlInput
                      label="Hero Background Image"
                      value={content.home.heroBackgroundImage}
                      onChange={(next) => setContent((c) => ({ ...c, home: { ...c.home, heroBackgroundImage: next } }))}
                      placeholder="https://..."
                      accept="image/*"
                      fieldClass={fieldClass}
                      labelClass={labelClass}
                      passcode={passcode}
                      uploadUrl={mediaUploadUrl}
                      onToast={setToast}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-white/5 p-6 bg-black/20">
                <h3 className="text-white font-semibold mb-4">Mandate Section</h3>
                <div className="space-y-4">
                  <input
                    className={fieldClass}
                    value={content.home.mandateTitle}
                    onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, mandateTitle: e.target.value } }))}
                    placeholder="Mandate Title"
                  />
                  <textarea
                    className={fieldClass}
                    value={content.home.mandateParagraph1}
                    onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, mandateParagraph1: e.target.value } }))}
                    placeholder="Paragraph 1"
                    rows={4}
                  />
                  <textarea
                    className={fieldClass}
                    value={content.home.mandateParagraph2}
                    onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, mandateParagraph2: e.target.value } }))}
                    placeholder="Paragraph 2"
                    rows={4}
                  />
                  <UploadableUrlInput
                    label="Mandate Image"
                    value={content.home.mandateImage}
                    onChange={(next) => setContent((c) => ({ ...c, home: { ...c.home, mandateImage: next } }))}
                    placeholder="https://..."
                    accept="image/*"
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    passcode={passcode}
                    uploadUrl={mediaUploadUrl}
                    onToast={setToast}
                  />
                </div>
              </div>

              <div className="border border-white/5 p-6 bg-black/20">
                <h3 className="text-white font-semibold mb-4">Social Media Feed</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label className={labelClass}>Feed Title</label>
                       <input
                        className={fieldClass}
                        value={content.home.socialFeedTitle || ''}
                        onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, socialFeedTitle: e.target.value } }))}
                        placeholder="Community Voices"
                      />
                     </div>
                     <div>
                       <label className={labelClass}>Feed Subtitle</label>
                       <input
                        className={fieldClass}
                        value={content.home.socialFeedSubtitle || ''}
                        onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, socialFeedSubtitle: e.target.value } }))}
                        placeholder="Join the conversation"
                      />
                     </div>
                  </div>
                  <div>
                    <label className={labelClass}>Social Feed Embed Code</label>
                    <textarea
                      className={fieldClass}
                      value={content.home.socialFeedEmbedCode || ''}
                      onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, socialFeedEmbedCode: e.target.value } }))}
                      placeholder="Paste your Twitter Timeline or Instagram Widget code here..."
                      rows={6}
                    />
                    <p className={helpClass}>
                      Paste the embed code from Twitter Publish, SnapWidget, or Facebook Plugin here.
                      If left empty, the site will show the simulated community feed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-white/5 p-6 bg-black/20">
                <h3 className="text-white font-semibold mb-4">Announcements (Home Page)</h3>
                <div className="space-y-6">
                  {content.announcements.map((item, idx) => (
                    <div key={item.id} className="border-t border-white/5 pt-4 first:border-0 first:pt-0 relative">
                      <div className="absolute top-0 right-0">
                         <Button
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() =>
                            setContent((c) => {
                              const next = [...c.announcements];
                              next.splice(idx, 1);
                              return { ...c, announcements: next };
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 pr-16">
                        <div>
                          <label className={labelClass}>Date</label>
                          <input
                            className={fieldClass}
                            value={item.date}
                            onChange={(e) =>
                              setContent((c) => {
                                const next = [...c.announcements];
                                next[idx] = { ...next[idx], date: e.target.value };
                                return { ...c, announcements: next };
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Title</label>
                          <input
                            className={fieldClass}
                            value={item.title}
                            onChange={(e) =>
                              setContent((c) => {
                                const next = [...c.announcements];
                                next[idx] = { ...next[idx], title: e.target.value };
                                return { ...c, announcements: next };
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Excerpt</label>
                          <textarea
                            className={fieldClass}
                            rows={2}
                            value={item.excerpt}
                            onChange={(e) =>
                              setContent((c) => {
                                const next = [...c.announcements];
                                next[idx] = { ...next[idx], excerpt: e.target.value };
                                return { ...c, announcements: next };
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        announcements: [
                          ...c.announcements,
                          {
                            id: Date.now().toString(),
                            date: 'Coming Soon',
                            title: 'New Announcement',
                            excerpt: 'Details...',
                          },
                        ],
                      }))
                    }
                  >
                    Add Announcement
                  </Button>
                </div>
              </div>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Lectures & Archive</summary>
            <div className={`mt-4 ${helpClass}`}>Manage past lectures and speakers.</div>
            <div className="mt-8 space-y-8">
              {content.lectures.map((lecture, idx) => (
                <div key={lecture.id} className="border border-white/5 p-6 bg-black/20 relative">
                  <div className="absolute top-4 right-4">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setContent((c) => {
                          const next = [...c.lectures];
                          next.splice(idx, 1);
                          return { ...c, lectures: next };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Year</label>
                      <input
                        type="number"
                        className={fieldClass}
                        value={lecture.year}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], year: parseInt(e.target.value) || 0 };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Theme</label>
                      <input
                        className={fieldClass}
                        value={lecture.theme}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], theme: e.target.value };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Speaker Name</label>
                      <input
                        className={fieldClass}
                        value={lecture.speaker}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], speaker: e.target.value };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Role / Title</label>
                      <input
                        className={fieldClass}
                        value={lecture.role}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], role: e.target.value };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Lecture Title</label>
                      <input
                        className={fieldClass}
                        value={lecture.title}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Description</label>
                      <textarea
                        className={fieldClass}
                        rows={3}
                        value={lecture.description}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], description: e.target.value };
                            return { ...c, lectures: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <UploadableUrlInput
                        label="Speaker Image"
                        value={lecture.image}
                        onChange={(val) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], image: val };
                            return { ...c, lectures: next };
                          })
                        }
                        placeholder="https://..."
                        accept="image/*"
                        fieldClass={fieldClass}
                        labelClass={labelClass}
                        passcode={passcode}
                        uploadUrl={mediaUploadUrl}
                        onToast={setToast}
                      />
                    </div>
                    <div>
                      <UploadableUrlInput
                        label="PDF URL"
                        value={lecture.pdfUrl || ''}
                        onChange={(val) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], pdfUrl: val };
                            return { ...c, lectures: next };
                          })
                        }
                        placeholder="https://..."
                        accept="application/pdf"
                        fieldClass={fieldClass}
                        labelClass={labelClass}
                        passcode={passcode}
                        uploadUrl={mediaUploadUrl}
                        onToast={setToast}
                      />
                    </div>
                    <div>
                      <UploadableUrlInput
                        label="Recording URL"
                        value={lecture.recordingUrl || ''}
                        onChange={(val) =>
                          setContent((c) => {
                            const next = [...c.lectures];
                            next[idx] = { ...next[idx], recordingUrl: val };
                            return { ...c, lectures: next };
                          })
                        }
                        placeholder="https://..."
                        accept="video/*,audio/*"
                        fieldClass={fieldClass}
                        labelClass={labelClass}
                        passcode={passcode}
                        uploadUrl={mediaUploadUrl}
                        onToast={setToast}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    lectures: [
                      {
                        id: Date.now().toString(),
                        year: new Date().getFullYear(),
                        theme: 'New Theme',
                        speaker: 'Speaker Name',
                        title: 'Lecture Title',
                        description: 'Description...',
                        image: '',
                        role: 'Keynote Speaker',
                      },
                      ...c.lectures,
                    ],
                  }))
                }
              >
                Add Lecture
              </Button>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">News & Blog</summary>
            <div className={`mt-4 ${helpClass}`}>Manage news articles and blog posts.</div>
            <div className="mt-8 space-y-8">
              {content.blogPosts.map((post, idx) => (
                <div key={post.id} className="border border-white/5 p-6 bg-black/20 relative">
                  <div className="absolute top-4 right-4">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setContent((c) => {
                          const next = [...c.blogPosts];
                          next.splice(idx, 1);
                          return { ...c, blogPosts: next };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                      <label className={labelClass}>Title</label>
                      <input
                        className={fieldClass}
                        value={post.title}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Date</label>
                      <input
                        className={fieldClass}
                        value={post.date}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], date: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                     <div>
                      <label className={labelClass}>Slug (URL path)</label>
                      <input
                        className={fieldClass}
                        value={post.slug}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], slug: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Author</label>
                      <input
                        className={fieldClass}
                        value={post.author}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], author: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Excerpt (Short Summary)</label>
                      <textarea
                        className={fieldClass}
                        rows={2}
                        value={post.excerpt}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], excerpt: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Content (HTML or Markdown)</label>
                      <textarea
                        className={fieldClass}
                        rows={6}
                        value={post.content}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], content: e.target.value };
                            return { ...c, blogPosts: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <UploadableUrlInput
                        label="Featured Image"
                        value={post.image || ''}
                        onChange={(val) =>
                          setContent((c) => {
                            const next = [...c.blogPosts];
                            next[idx] = { ...next[idx], image: val };
                            return { ...c, blogPosts: next };
                          })
                        }
                        placeholder="https://..."
                        accept="image/*"
                        fieldClass={fieldClass}
                        labelClass={labelClass}
                        passcode={passcode}
                        uploadUrl={mediaUploadUrl}
                        onToast={setToast}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    blogPosts: [
                      {
                        id: Date.now().toString(),
                        slug: `post-${Date.now()}`,
                        title: 'New Post',
                        excerpt: 'Summary...',
                        content: 'Content...',
                        author: 'Admin',
                        date: new Date().toISOString().split('T')[0],
                        image: '',
                      },
                      ...c.blogPosts,
                    ],
                  }))
                }
              >
                Add Post
              </Button>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Resources (Downloads)</summary>
            <div className={`mt-4 ${helpClass}`}>Manage downloadable files.</div>
            
            <div 
              className="mt-6 border border-dashed border-white/10 rounded-sm bg-charcoal/30 p-6 text-gray-300 transition-colors hover:bg-charcoal/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleBulkUploadDownloads(e.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-4 items-center">
                <div className="text-sm text-center text-gray-400">
                  <span className="text-white font-medium">Bulk Upload:</span> Drag & Drop files here to auto-add them to the list.
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="bulk-resources-upload"
                  onChange={(e) => {
                     const files = Array.from(e.target.files || []).filter((f) => f && typeof f.name === 'string');
                     setBulkResourceNames(files.map((f) => f.name));
                     handleBulkUploadDownloads(files);
                     e.target.value = '';
                  }}
                  disabled={uploadBusy}
                />
                <Button 
                   variant="outline" 
                   onClick={() => document.getElementById('bulk-resources-upload')?.click()}
                   disabled={uploadBusy}
                >
                  {uploadBusy ? 'Uploading...' : 'Select Files'}
                </Button>
                {bulkResourceNames.length > 0 && (
                  <div className="text-xs text-gray-500 text-center max-w-full truncate" title={bulkResourceNames.join(', ')}>
                    {bulkResourceNames.length === 1 ? bulkResourceNames[0] : `${bulkResourceNames.length} files selected`}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {content.downloads.map((item, idx) => (
                <div key={item.id} className="border border-white/5 p-6 bg-black/20 relative">
                   <div className="absolute top-4 right-4">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setContent((c) => {
                          const next = [...c.downloads];
                          next.splice(idx, 1);
                          return { ...c, downloads: next };
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Title</label>
                      <input
                        className={fieldClass}
                        value={item.title}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.downloads];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...c, downloads: next };
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Category</label>
                      <select
                        className={fieldClass}
                        value={item.category}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.downloads];
                            next[idx] = { ...next[idx], category: e.target.value as any };
                            return { ...c, downloads: next };
                          })
                        }
                      >
                        <option value="General">General</option>
                        <option value="Press">Press</option>
                        <option value="Academic">Academic</option>
                      </select>
                    </div>
                    <div>
                       <label className={labelClass}>File Size (e.g. "2.4 MB")</label>
                       <input
                        className={fieldClass}
                        value={item.size}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.downloads];
                            next[idx] = { ...next[idx], size: e.target.value };
                            return { ...c, downloads: next };
                          })
                        }
                      />
                    </div>
                     <div>
                       <label className={labelClass}>File Type (e.g. "PDF")</label>
                       <input
                        className={fieldClass}
                        value={item.type}
                        onChange={(e) =>
                          setContent((c) => {
                            const next = [...c.downloads];
                            next[idx] = { ...next[idx], type: e.target.value };
                            return { ...c, downloads: next };
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <UploadableUrlInput
                        label="File URL"
                        value={item.url || ''}
                        onChange={(val) =>
                          setContent((c) => {
                            const next = [...c.downloads];
                            next[idx] = { ...next[idx], url: val };
                            return { ...c, downloads: next };
                          })
                        }
                        placeholder="https://..."
                        fieldClass={fieldClass}
                        labelClass={labelClass}
                        passcode={passcode}
                        uploadUrl={mediaUploadUrl}
                        onToast={setToast}
                      />
                    </div>
                  </div>
                </div>
              ))}
               <Button
                variant="outline"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    downloads: [
                      {
                        id: Date.now().toString(),
                        title: 'New Document',
                        size: '0 KB',
                        type: 'PDF',
                        category: 'General',
                        url: '',
                      },
                      ...c.downloads,
                    ],
                  }))
                }
              >
                Add Download
              </Button>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Footer</summary>
            <div className={`mt-4 ${helpClass}`}>Edit the footer description and credits.</div>
            <div className="mt-8 grid grid-cols-1 gap-6">
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={fieldClass}
                  value={content.footer.description}
                  onChange={(e) => setContent((c) => ({ ...c, footer: { ...c.footer, description: e.target.value } }))}
                  rows={3}
                />
              </div>
              <div>
                <label className={labelClass}>Credit Line</label>
                <input
                  className={fieldClass}
                  value={content.footer.credit}
                  onChange={(e) => setContent((c) => ({ ...c, footer: { ...c.footer, credit: e.target.value } }))}
                />
              </div>
            </div>
          </details>

          <details className="border border-white/5 bg-charcoal/50 p-8">
            <summary className="cursor-pointer select-none text-white font-display text-2xl">Contact Page</summary>
            <div className={`mt-4 ${helpClass}`}>Edit contact details and form labels.</div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  className={fieldClass}
                  value={content.contact.email}
                  onChange={(e) => setContent((c) => ({ ...c, contact: { ...c.contact, email: e.target.value } }))}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  className={fieldClass}
                  value={content.contact.phone}
                  onChange={(e) => setContent((c) => ({ ...c, contact: { ...c.contact, phone: e.target.value } }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Address</label>
                <textarea
                  className={fieldClass}
                  value={content.contact.address}
                  onChange={(e) => setContent((c) => ({ ...c, contact: { ...c.contact, address: e.target.value } }))}
                  rows={3}
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </>
  );
};
