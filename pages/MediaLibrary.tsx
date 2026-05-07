import React, { useEffect, useState } from 'react';
import { Section } from '../components/Section';
import { MediaPreview, MediaItem } from '../components/media/MediaPreview';

const TABS = [
  { label: 'All', type: '' },
  { label: 'Audio / Music', type: 'audio' },
  { label: 'Video', type: 'video' },
  { label: 'Images', type: 'image' },
  { label: 'Documents', type: 'pdf' },
];

export const MediaLibrary: React.FC = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeType, setActiveType] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const q = activeType ? `?type=${activeType}` : '';
    fetch(`/api/media${q}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) { setItems(json.items); setTotal(json.total ?? json.items.length); }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeType]);

  return (
    <Section background="darker" className="pt-32 pb-20">
      <div className="container mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-10">
          <p className="text-gold-500 text-xs uppercase tracking-widest mb-2">Heritage Colloquium</p>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-3">Media Library</h1>
          <p className="text-gray-400 max-w-xl">
            Lectures, music, recordings, photographs and more from The Heritage Colloquium archive.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex flex-wrap gap-1 mb-10 border-b border-white/10">
          {TABS.map(tab => (
            <button
              key={tab.type}
              onClick={() => setActiveType(tab.type)}
              className={`px-4 py-3 text-xs uppercase tracking-widest transition-all ${
                activeType === tab.type
                  ? 'text-gold-500 border-b-2 border-gold-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-charcoal border border-white/5 rounded-sm p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded mb-3 w-2/3" />
                <div className="h-16 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {total > 0 && (
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-6">
                {total} item{total !== 1 ? 's' : ''}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map(item => (
                <div key={item.id} className="bg-charcoal border border-white/10 rounded-sm p-4 hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-white font-medium truncate flex-1 pr-2">{item.title || 'Untitled'}</p>
                    <span className="text-xs text-gold-500 uppercase tracking-wider flex-shrink-0 bg-gold-500/10 px-2 py-0.5 rounded">
                      {item.type}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2">{item.description}</p>
                  )}
                  <MediaPreview item={item} />
                </div>
              ))}
              {!loading && items.length === 0 && (
                <div className="col-span-2 text-center py-16">
                  <p className="text-gray-500">No media in this category yet.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
};
