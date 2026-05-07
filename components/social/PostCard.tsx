import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { SmartImage } from '../ui/SmartImage';

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: string;
  mime_type: string;
}

interface Post {
  id: string;
  author: string;
  content: string;
  media_items?: MediaItem[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
  onAddComment: (id: string, content: string, author: string) => void;
  fetchComments: (id: string) => Promise<Comment[]>;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onLike, onAddComment, fetchComments }) => {
  const [likes, setLikes] = useState(post.likesCount);
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const handleLike = () => {
    if (hasLiked) return;
    setLikes(prev => prev + 1);
    setHasLiked(true);
    onLike(post.id);
  };

  const handleToggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const data = await fetchComments(post.id);
      setComments(data);
      setLoadingComments(false);
    }
    setShowComments(!showComments);
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const tempComment: Comment = {
      id: Date.now().toString(),
      author: 'You', // Will be replaced by backend
      content: newComment,
      createdAt: new Date().toISOString()
    };
    
    setComments([...comments, tempComment]);
    onAddComment(post.id, newComment, 'You');
    setNewComment('');
  };

  const renderMedia = (media: MediaItem) => {
    if (media.type === 'image' || media.mime_type?.startsWith('image/')) {
      return (
        <SmartImage 
          key={media.id}
          src={media.url} 
          alt="Post content" 
          className="w-full h-auto rounded-sm mb-4"
          fallbackSrc=""
        />
      );
    }
    if (media.type === 'video' || media.mime_type?.startsWith('video/')) {
      return (
        <video 
          key={media.id}
          controls 
          className="w-full h-auto rounded-sm mb-4 bg-black"
        >
          <source src={media.url} type={media.mime_type} />
          Your browser does not support the video tag.
        </video>
      );
    }
    if (media.type === 'audio' || media.mime_type?.startsWith('audio/')) {
      return (
        <audio 
          key={media.id}
          controls 
          className="w-full mb-4"
        >
          <source src={media.url} type={media.mime_type} />
          Your browser does not support the audio element.
        </audio>
      );
    }
    return null;
  };

  return (
    <div className="border border-white/5 bg-charcoal/30 p-6 rounded-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold">
            {post.author.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-white font-medium">{post.author}</div>
            <div className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <div className="text-gray-300 mb-4 leading-relaxed whitespace-pre-wrap">
        {post.content}
      </div>

      {post.media_items && post.media_items.length > 0 && (
        <div className="mb-4">
          {post.media_items.map(renderMedia)}
        </div>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 text-sm transition-colors ${hasLiked ? 'text-gold-500' : 'text-gray-400 hover:text-white'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill={hasLiked ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <span>{likes}</span>
        </button>
        
        <button 
          onClick={handleToggleComments}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span>{comments.length || post.commentsCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-4 pl-4 border-l border-white/10">
          {loadingComments && <div className="text-xs text-gray-500">Loading comments...</div>}
          
          {comments.map(comment => (
            <div key={comment.id} className="bg-black/20 p-3 rounded-sm">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-gray-300">{comment.author}</span>
                <span className="text-[10px] text-gray-600">{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-400">{comment.content}</p>
            </div>
          ))}

          <form onSubmit={handleSubmitComment} className="mt-4 space-y-2">
            <textarea
              className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              placeholder="Write a comment..."
              rows={2}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              required
            />
            <Button type="submit" variant="outline" className="text-xs py-1 h-8">Post Comment</Button>
          </form>
        </div>
      )}
    </div>
  );
};
