import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface CreatePostProps {
  onPost: (content: string, mediaIds?: string[]) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const CreatePost: React.FC<CreatePostProps> = ({ onPost }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState<Array<{ id: string; label: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persistAttachmentLabel = async (id: string, label: string) => {
    const title = label.trim();
    if (!title) return;
    try {
      await fetch(`${API_BASE}/media/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaAttachments.length === 0) return;
    
    onPost(content, mediaAttachments.map((m) => m.id));
    setContent('');
    setMediaAttachments([]);
    setIsExpanded(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f && typeof f.name === 'string');
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const next: Array<{ id: string; label: string }> = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: formData
        });
        const json = await res.json();
        if (json.ok && json.item?.id) {
          next.push({ id: json.item.id, label: file.name });
        } else {
          alert('Upload failed: ' + (json?.error || 'Unknown error'));
        }
      }
      if (next.length > 0) setMediaAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!user) {
    return (
      <div className="border border-white/5 bg-charcoal/50 p-6 mb-8 rounded-sm text-center">
        <p className="text-gray-400 mb-4">Sign in to share your thoughts, music, or videos with the community.</p>
        <div className="flex justify-center gap-4">
          <Link to="/login"><Button variant="outline">Sign In</Button></Link>
          <Link to="/register"><Button>Join Now</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/5 bg-charcoal/50 p-6 mb-8 rounded-sm">
      {!isExpanded ? (
        <div 
          onClick={() => setIsExpanded(true)}
          className="bg-black/30 border border-white/10 p-4 text-gray-500 cursor-text hover:bg-black/40 transition-colors rounded-sm flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 text-xs font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span>Share your thoughts...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 text-xs font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-300">{user.username}</span>
          </div>
          
          <textarea
            className="w-full bg-black/30 border border-white/10 p-4 text-white placeholder:text-gray-500 focus:border-gold-500 focus:outline-none transition-colors min-h-[120px] rounded-sm resize-none"
            placeholder="What's on your mind?"
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
          />

          {mediaAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mediaAttachments.map(({ id, label }) => (
                <div key={id} className="bg-gold-500/10 border border-gold-500/30 px-3 py-1 rounded-full text-xs text-gold-500 flex items-center gap-2">
                  <input
                    className="bg-transparent outline-none max-w-[220px] truncate"
                    value={label}
                    onChange={(e) => setMediaAttachments((prev) => prev.map((m) => (m.id === id ? { ...m, label: e.target.value } : m)))}
                    onBlur={() => {
                      const current = mediaAttachments.find((m) => m.id === id);
                      if (current) void persistAttachmentLabel(id, current.label);
                    }}
                    disabled={uploading}
                  />
                  <button 
                    type="button" 
                    onClick={() => setMediaAttachments((prev) => prev.filter((m) => m.id !== id))}
                    className="hover:text-white"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
              />
              <Button 
                type="button" 
                variant="ghost" 
                className="!text-xs !py-2 !px-3 flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                {uploading ? 'Uploading...' : 'Attach Media'}
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsExpanded(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || (!content.trim() && mediaAttachments.length === 0)}>
                Post Update
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
