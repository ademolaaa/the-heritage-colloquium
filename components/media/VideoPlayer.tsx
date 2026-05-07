import React from 'react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  poster?: string;
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, poster }) => {
  const embedUrl = getEmbedUrl(url);

  if (embedUrl) {
    return (
      <div className="relative w-full rounded-sm overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={embedUrl}
          title={title || 'Video'}
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
        />
      </div>
    );
  }

  // Native video for direct file URLs (Supabase Storage)
  return (
    <video
      src={url}
      poster={poster}
      controls
      playsInline
      className="w-full rounded-sm bg-black"
      style={{ maxHeight: 420 }}
    >
      Your browser does not support video playback.
    </video>
  );
};
