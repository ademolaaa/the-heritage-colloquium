import React, { useRef, useState } from 'react';

interface AudioPlayerProps {
  url: string;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, title }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().catch(() => {}); setPlaying(true); }
  };

  const onTimeUpdate = () => {
    if (!ref.current || !ref.current.duration) return;
    setProgress((ref.current.currentTime / ref.current.duration) * 100);
  };

  return (
    <div className="bg-charcoal border border-white/10 rounded-sm p-4 flex items-center gap-4">
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-black hover:bg-gold-400 transition-colors flex-shrink-0 text-sm"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate mb-1">{title || 'Audio'}</p>
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className="bg-gold-500 h-1 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <audio
          ref={ref}
          src={url}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={onTimeUpdate}
          className="hidden"
        />
      </div>
    </div>
  );
};
