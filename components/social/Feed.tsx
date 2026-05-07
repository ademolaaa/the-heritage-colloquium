import React, { useEffect, useState } from 'react';
import { Section } from '../Section';
import { PostCard } from './PostCard';
import { CreatePost } from './CreatePost';
import { useAuth } from '../../context/AuthContext';
import { useSiteContent } from '../SiteContentProvider';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/social'; // Adjust based on config

export const SocialFeed: React.FC = () => {
  const { user } = useAuth();
  const { content } = useSiteContent();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const headers: Record<string, string> = {};
      if (localStorage.getItem('auth_token')) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('auth_token')}`;
      }
      
      const res = await fetch(`${API_BASE}/posts?limit=20`, { headers });
      const json = await res.json();
      if (json.ok) {
        setPosts(json.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async (content: string, mediaIds?: string[]) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ content, mediaIds })
      });
      const json = await res.json();
      if (json.ok) {
        // Add user info to the optimistic update
        const newPost = {
          ...json.item,
          author_name: user?.username || 'You',
          author_avatar: user?.avatar_url,
          latest_comments: []
        };
        setPosts([newPost, ...posts]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLike = async (id: string) => {
    if (!user) return; // Prevent liking if not logged in (UI should also handle this)
    try {
      await fetch(`${API_BASE}/posts/${id}/like`, { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (id: string, content: string, author: string) => {
    try {
      await fetch(`${API_BASE}/posts/${id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ content })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComments = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/comments`);
      const json = await res.json();
      return json.ok ? json.items.map((c: any) => ({
        id: c.id,
        content: c.content,
        author: c.author_name || 'Anonymous',
        createdAt: c.created_at || c.createdAt
      })) : [];
    } catch (e) {
      return [];
    }
  };

  return (
    <Section background="pattern" className="pt-32 pb-20">
      <div className="container mx-auto max-w-2xl px-6">
        <h1 className="font-display text-4xl text-white mb-2 text-center">Community Feed</h1>
        <p className="text-gray-400 text-center mb-10 font-light">Join the conversation about Ahiajoku.</p>

        {/* External Social Embed (e.g. Twitter/Instagram) */}
        {content.home.socialFeedEmbedCode && (
           <div className="mb-12 p-4 bg-charcoal border border-white/10 rounded-sm">
              <h3 className="text-gold-500 text-xs uppercase tracking-widest mb-4">Official Updates</h3>
              <div className="w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: content.home.socialFeedEmbedCode }} />
           </div>
        )}
        
        <CreatePost onPost={handleCreatePost} />
        
        {loading ? (
          <div className="text-center text-gray-500 py-10 animate-pulse">Loading updates...</div>
        ) : (
          <div>
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={{
                  id: post.id,
                  author: post.author_name || 'Anonymous',
                  content: post.content,
                  mediaId: post.media_ids && post.media_ids.length > 0 ? post.media_ids[0] : undefined,
                  likesCount: post.likes_count,
                  commentsCount: post.comments_count,
                  createdAt: post.created_at || post.createdAt
                }} 
                onLike={handleLike}
                onAddComment={handleAddComment}
                fetchComments={fetchComments}
              />
            ))}
            {posts.length === 0 && (
              <div className="text-center text-gray-500 py-10">No posts yet. Be the first to share!</div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
};
