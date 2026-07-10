import React, { useState } from 'react';
import { Section } from '../components/Section';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Persist token
        localStorage.setItem('auth_token', data.session.access_token);

        // Fetch the user role from our database via /api/auth/me (triggers backend sync)
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });

        let role = 'user';
        if (res.ok) {
          const profileData = await res.json();
          if (profileData.ok && profileData.user) {
            role = profileData.user.role;
          }
        }

        // Refresh the AuthContext to pick up DB role
        await refreshUser();

        if (role === 'admin' || role === 'moderator') {
          navigate('/admin/console');
        } else {
          navigate('/feed');
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section background="darker" className="pt-40 pb-20 min-h-screen flex items-center">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/10">
          <h1 className="font-display text-4xl text-white mb-2 text-center">Sign In</h1>
          <p className="text-gray-400 text-center mb-8">Access the community and admin tools.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-500 transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-500 text-black font-semibold py-3 rounded-xl hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-gold-500 hover:text-white transition-colors">
              Join Us
            </Link>
          </p>

          {/* First-time setup link — visible only when no admin exists */}
          <p className="mt-4 text-center text-gray-600 text-xs">
            First time?{' '}
            <Link to="/admin/setup" className="text-gray-500 hover:text-gold-500 transition-colors underline">
              Set up admin access
            </Link>
          </p>
        </div>
      </div>
    </Section>
  );
};
