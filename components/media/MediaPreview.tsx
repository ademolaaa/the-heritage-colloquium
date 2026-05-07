import React from 'react';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';

export interface MediaItem {
  id: string;
  type: string;
  url: string;
  title?: string;
  thumbnail_url?: string;
  description?: string;
}

interface MediaPreviewProps {
  item: MediaItem;
  className?: string;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ item, className = '' }) => {
  switch (item.type) {
    case 'audio':
      return <AudioPlayer url={item.url} title={item.title} />;
    case 'video':
      return <VideoPlayer url={item.url} title={item.title} poster={item.thumbnail_url} />;
    case 'image':
      return (
        <img
          src={item.url}
          alt={item.title || 'Image'}
          className={`w-full rounded-sm object-cover max-h-96 ${className}`}
          loading="lazy"
        />
      );
    case 'pdf':
      return (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 underline text-sm transition-colors"
        >
          📄 {item.title || 'View PDF'}
        </a>
      );
    default:
      return (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-gold-500 hover:text-gold-400 underline text-sm transition-colors"
        >
          📎 {item.title || 'Download File'}
        </a>
      );
  }
};
