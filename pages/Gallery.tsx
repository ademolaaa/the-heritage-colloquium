import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '../components/Section';
import { GalleryItem, MediaItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { placeholderImageDataUri } from '../lib/placeholders';
import { categoryTitle } from '../lib/categories';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const Gallery: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryFilter = searchParams.get('category');
  
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, MediaItem>>({});
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);

  const v1ApiBaseUrl = (((import.meta as any).env?.VITE_V1_API_BASE_URL as string | undefined) || '').trim();
  
  const getApiUrl = (path: string) => {
    const fullPath = path === '/gallery' ? '/api/v1/gallery' : '/api/media';
    if (!v1ApiBaseUrl) return fullPath;
    try {
      return new URL(fullPath, v1ApiBaseUrl).toString();
    } catch {
      return fullPath;
    }
  };

  const galleryApiUrl = useMemo(() => getApiUrl('/gallery'), [v1ApiBaseUrl]);
  const mediaApiUrl = useMemo(() => getApiUrl('/media'), [v1ApiBaseUrl]);

  useEffect(() => {
    const load = async () => {
      try {
        if (categoryFilter) {
          // Load media directly by category
          const res = await fetch(`${mediaApiUrl}?category=${encodeURIComponent(categoryFilter)}&limit=100`);
          const json = await res.json();
          if (json.ok && Array.isArray(json.items)) {
             // Create a virtual gallery for this category
             const items = json.items as MediaItem[];
             const virtualGallery: GalleryItem = {
               id: 'virtual-' + categoryFilter,
               title: categoryTitle(categoryFilter),
               description: `Media archive for ${categoryTitle(categoryFilter)}`,
               year: new Date().getFullYear(),
               mediaIds: items.map(m => m.id),
               coverImage: items.find(m => m.type === 'image')?.url || '',
             };
             setGalleries([virtualGallery]);
             setSelectedGallery(virtualGallery);
             setMediaMap(prev => {
                const next = { ...prev };
                items.forEach(m => next[m.id] = m);
                return next;
             });
          }
        } else {
          const topicsRes = await fetch(`${mediaApiUrl}?categories=1&limit=500`);
          const topicsJson = await topicsRes.json().catch(() => null);
          if (topicsJson?.ok && Array.isArray(topicsJson.items)) {
            setTopics(topicsJson.items.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()));
          } else {
            setTopics([]);
          }

          // Load regular galleries
          const res = await fetch(`${galleryApiUrl}?limit=100`);
          const json = await res.json();
          if (json.ok && Array.isArray(json.items)) {
            setGalleries(json.items);
            
            // Collect all needed media IDs (covers)
            const allIds = new Set<string>();
            json.items.forEach((g: GalleryItem) => {
               if (g.mediaIds && g.mediaIds.length > 0) {
                   allIds.add(g.mediaIds[0]); 
               }
            });
            
            if (allIds.size > 0) {
              const idsParam = Array.from(allIds).join(',');
              const mRes = await fetch(`${mediaApiUrl}?ids=${idsParam}&limit=500`);
              const mJson = await mRes.json();
              if (mJson.ok && Array.isArray(mJson.items)) {
                setMediaMap(prev => {
                  const next = { ...prev };
                  mJson.items.forEach((m: MediaItem) => next[m.id] = m);
                  return next;
                });
              }
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [galleryApiUrl, mediaApiUrl, categoryFilter]);

  // When a gallery is selected, fetch its media
  useEffect(() => {
    if (!selectedGallery) return;
    const idsToFetch = selectedGallery.mediaIds.filter(id => !mediaMap[id]);
    if (idsToFetch.length === 0) return;

    const fetchMissing = async () => {
        try {
            // Batch fetch in chunks if needed, but for now assuming reasonable url length
            const idsParam = idsToFetch.join(',');
            const res = await fetch(`${mediaApiUrl}?ids=${idsParam}&limit=500`);
            const json = await res.json();
             if (json.ok && Array.isArray(json.items)) {
              setMediaMap(prev => {
                const next = { ...prev };
                json.items.forEach((m: MediaItem) => next[m.id] = m);
                return next;
              });
            }
        } catch {}
    };
    fetchMissing();
  }, [selectedGallery, mediaApiUrl]);

  useEffect(() => {
    if (!lightboxMedia) return;
    setLightboxZoom(1);
  }, [lightboxMedia?.id]);

  return (
    <>
      <div className="pt-32 pb-16 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6">
          <h1 className="font-display text-5xl text-white mb-6">Gallery</h1>
          <p className="text-gray-400 max-w-2xl text-lg font-serif italic">
            Moments from The Heritage Colloquium events.
          </p>
        </div>
      </div>

      <Section background="pattern">
        <AnimatePresence mode="wait">
          {!selectedGallery ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {topics.length > 0 && (
                <div className="mb-14">
                  <div className="text-white font-semibold mb-4">Topics</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => navigate(`/gallery?category=${encodeURIComponent(cat)}`)}
                        className="text-left group border border-white/10 bg-charcoal/50 p-6 hover:bg-white/5 hover:border-gold-500/40 transition-colors"
                      >
                        <div className="text-lg text-white font-display group-hover:text-gold-500 transition-colors">
                          {categoryTitle(cat)}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-widest text-gray-500">View media →</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {galleries.map(gallery => {
                  const ids = Array.isArray(gallery.mediaIds) ? gallery.mediaIds : [];
                  const cover =
                    ids.map((id) => mediaMap[id]).find((m) => m && m.type === 'image') ||
                    ids.map((id) => mediaMap[id]).find(Boolean) ||
                    null;
                  const placeholder = placeholderImageDataUri({ width: 1200, height: 900, label: gallery.title });
                  
                  return (
                    <div 
                      key={gallery.id} 
                      onClick={() => setSelectedGallery(gallery)}
                      className="group cursor-pointer border border-white/5 bg-charcoal/50 hover:border-gold-500/50 transition-colors"
                    >
                      <div className="aspect-[4/3] bg-black/50 overflow-hidden relative">
                        {cover?.type === 'video' ? (
                          <video
                            src={cover.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <img
                            src={cover?.url || placeholder}
                            alt={gallery.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                      </div>
                      <div className="p-6">
                        <div className="text-gold-500 text-xs tracking-widest uppercase mb-2">
                          {gallery.year || 'Event'}
                        </div>
                        <h3 className="text-2xl text-white font-display mb-2 group-hover:text-gold-500 transition-colors">
                          {gallery.title}
                        </h3>
                        <p className="text-gray-400 text-sm line-clamp-2">
                          {gallery.description}
                        </p>
                        <div className="text-gold-500 text-xs font-semibold uppercase tracking-wider group-hover:text-white transition-colors flex items-center gap-1.5 mt-4">
                          <span>Click to open and view more pictures</span>
                          <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {galleries.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-20">
                    No galleries found.
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button 
                onClick={() => {
                  if (categoryFilter) {
                    navigate('/programs');
                  } else {
                    setSelectedGallery(null);
                  }
                }}
                className="text-gold-500 text-sm uppercase tracking-widest mb-8 hover:text-white transition-colors flex items-center gap-2"
              >
                ← Back to {categoryFilter ? 'Programs' : 'Galleries'}
              </button>
              
              <div className="mb-12">
                <h2 className="text-4xl text-white font-display mb-4">{selectedGallery.title}</h2>
                <p className="text-gray-400 max-w-3xl leading-relaxed">{selectedGallery.description}</p>
              </div>

              {selectedGallery.mediaIds.length === 0 && (
                <div className="border border-white/5 bg-black/20 p-8 text-gray-400">
                  No media yet for this topic. Upload files in Admin → Uploads and select this category.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedGallery.mediaIds.map(mid => {
                  const m = mediaMap[mid];
                  if (!m) return (
                    <div key={mid} className="aspect-square bg-white/5 animate-pulse" />
                  );
                  
                  return (
                    <motion.div 
                      key={mid}
                      layoutId={mid}
                      onClick={() => setLightboxMedia(m)}
                      className="cursor-zoom-in relative group overflow-hidden border border-white/5 bg-black"
                    >
                        {m.type === 'video' ? (
                            <video src={m.url} className="w-full aspect-square object-cover" />
                        ) : (
                            <img 
                                src={m.url} 
                                alt={m.title} 
                                loading="lazy"
                                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                        )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxMedia(null)}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
          >
            <motion.div 
                layoutId={lightboxMedia.id}
                className="relative max-w-full max-h-full"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute -top-12 left-0 flex items-center gap-2">
                  {lightboxMedia.type === 'image' && (
                    <>
                      <button
                        onClick={() => setLightboxZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                        className="text-white/70 hover:text-white uppercase tracking-widest text-xs"
                        disabled={lightboxZoom <= 1}
                      >
                        -
                      </button>
                      <button
                        onClick={() => setLightboxZoom(1)}
                        className="text-white/70 hover:text-white uppercase tracking-widest text-xs"
                        disabled={lightboxZoom === 1}
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setLightboxZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                        className="text-white/70 hover:text-white uppercase tracking-widest text-xs"
                        disabled={lightboxZoom >= 4}
                      >
                        +
                      </button>
                    </>
                  )}
                  {lightboxMedia.type === 'video' && (
                    <button
                      onClick={() => {
                        const el = lightboxVideoRef.current;
                        if (!el) return;
                        const anyEl = el as any;
                        if (typeof anyEl.requestFullscreen === 'function') anyEl.requestFullscreen();
                      }}
                      className="text-white/70 hover:text-white uppercase tracking-widest text-xs"
                    >
                      Fullscreen
                    </button>
                  )}
                </div>
                {lightboxMedia.type === 'video' ? (
                    <video ref={lightboxVideoRef} src={lightboxMedia.url} controls autoPlay className="max-w-full max-h-[90vh]" />
                ) : (
                    <img
                      src={lightboxMedia.url}
                      alt={lightboxMedia.title}
                      className="max-w-full max-h-[90vh] object-contain"
                      style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center' }}
                    />
                )}
                <button 
                    onClick={() => setLightboxMedia(null)}
                    className="absolute -top-12 right-0 text-white/50 hover:text-white uppercase tracking-widest text-xs"
                >
                    Close
                </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
