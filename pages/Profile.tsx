import React, { useState, useEffect } from 'react';
import { Section } from '../components/Section';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { UploadWidget } from '../components/ui/UploadWidget';

interface UserStats {
  postsCount: number;
  likesCount: number;
  questionsCount: number;
  commentsCount: number;
}

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [stats, setStats] = useState<UserStats>({
    postsCount: 0,
    likesCount: 0,
    questionsCount: 0,
    commentsCount: 0,
  });

  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const res = await fetch('/api/auth/me/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.ok) {
        setStats(json.stats);
      }
    } catch (e) {
      console.error('Failed to fetch user stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // 1. Update Supabase User Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim(),
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // 2. Sync to local Postgres database
      const token = localStorage.getItem('auth_token');
      if (token) {
        const syncRes = await fetch('/api/auth/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            username: username.trim(),
            fullName: fullName.trim(),
            avatarUrl: avatarUrl.trim()
          })
        });
        const syncJson = await syncRes.json();
        if (!syncJson.ok) {
          throw new Error(syncJson.error || 'Failed to sync with database');
        }
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="pt-32 pb-16 min-h-screen bg-obsidian flex justify-center items-center">
        <div className="text-white text-center">
          <h1 className="font-display text-4xl mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">Please log in to view your profile.</p>
          <a href="/login" className="bg-gold-500 hover:bg-gold-600 text-black px-6 py-2 rounded-sm font-serif font-semibold transition-colors">
            Log In
          </a>
        </div>
      </div>
    );
  }

  const monogram = (fullName || user.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <div className="pt-32 pb-16 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="font-display text-5xl text-white mb-3">Your Profile</h1>
              <p className="text-gray-400 max-w-xl text-lg font-serif italic">
                Manage your Heritage Colloquium credentials and community standing.
              </p>
            </div>
            <div>
              <button 
                onClick={logout}
                className="border border-white/10 hover:border-red-500/50 hover:bg-red-950/20 text-gray-400 hover:text-red-400 px-6 py-2.5 text-sm uppercase tracking-widest transition-colors font-serif cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <Section background="pattern" className="py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Sidebar / Overview */}
          <div className="space-y-8">
            <div className="bg-charcoal/30 border border-white/5 p-8 rounded-sm text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold-600 via-gold-500 to-gold-400" />
              
              <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border border-white/10 mb-6 bg-gradient-to-br from-gold-500/10 to-gold-500/30 flex items-center justify-center relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gold-500 font-display text-4xl">{monogram}</span>
                )}
              </div>

              <h2 className="text-2xl text-white font-display mb-1">{fullName || 'Heritage Member'}</h2>
              <p className="text-gray-500 text-sm font-serif italic mb-4">@{username}</p>
              
              <div className="inline-block bg-gold-500/10 border border-gold-500/20 text-gold-500 text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-serif">
                {user.role}
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 text-left text-xs text-gray-500 space-y-2">
                <div>
                  <span className="text-gray-400 block font-serif">Registered Email</span>
                  <span className="text-white text-sm break-all">{user.email}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="bg-charcoal/30 border border-white/5 p-8 rounded-sm">
              <h3 className="text-white font-display text-lg mb-6 tracking-wide border-b border-white/5 pb-3">Community Stats</h3>
              
              {loadingStats ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-white/5 rounded-sm" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-4 border border-white/5 text-center">
                    <div className="text-3xl text-gold-500 font-display font-bold">{stats.postsCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Posts</div>
                  </div>
                  <div className="bg-black/20 p-4 border border-white/5 text-center">
                    <div className="text-3xl text-gold-500 font-display font-bold">{stats.likesCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Likes Recv</div>
                  </div>
                  <div className="bg-black/20 p-4 border border-white/5 text-center">
                    <div className="text-3xl text-gold-500 font-display font-bold">{stats.questionsCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Questions</div>
                  </div>
                  <div className="bg-black/20 p-4 border border-white/5 text-center">
                    <div className="text-3xl text-gold-500 font-display font-bold">{stats.commentsCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Comments</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-2">
            <div className="bg-charcoal/30 border border-white/5 p-8 md:p-10 rounded-sm">
              <h3 className="text-white font-display text-2xl mb-8 tracking-wide border-b border-white/5 pb-4">Account Settings</h3>
              
              {message && (
                <div className={`p-4 rounded-sm border mb-6 text-sm ${
                  message.type === 'success' 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-950/20 border-red-500/30 text-red-400'
                }`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2 font-serif">Display Name</label>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-gold-500 focus:outline-none transition-colors font-serif"
                      placeholder="e.g. Dr. Ademola"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2 font-serif">Username</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-gold-500 focus:outline-none transition-colors font-serif"
                      placeholder="e.g. ademola1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2 font-serif">Profile Picture / Avatar URL</label>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-gold-500 focus:outline-none transition-colors font-serif text-sm"
                      placeholder="https://example.com/avatar.jpg"
                    />
                    <div className="bg-black/30 p-4 border border-white/5 rounded-sm">
                      <span className="block text-[11px] text-gray-500 uppercase tracking-widest mb-3">Or Upload Directly</span>
                      <UploadWidget 
                        title="Upload Avatar Image"
                        description="Select an image file to use as your profile avatar."
                        accept="image/*"
                        onUploadComplete={(item: any) => {
                          if (item && item.url) {
                            setAvatarUrl(item.url);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center justify-end">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-gold-500 hover:bg-gold-600 text-black px-8 py-3 text-sm uppercase tracking-widest transition-colors font-serif font-bold cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
};
