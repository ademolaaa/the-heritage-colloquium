import React, { useState } from 'react';
import { Section } from '../components/Section';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // For now, we'll use a simple session storage for admin access
    // In a full implementation, this would call your /api/auth/login endpoint
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      if (response.ok) {
        localStorage.setItem('admin_passcode', passcode);
        localStorage.setItem('is_admin', 'true');
        navigate('/community');
      } else {
        setError('Invalid admin passcode. Please try again.');
      }
    } catch (err) {
      // Fallback for simple local testing or if API isn't ready
      if (passcode === 'Heritage2024') {
         localStorage.setItem('admin_passcode', passcode);
         localStorage.setItem('is_admin', 'true');
         navigate('/community');
      } else {
        setError('Could not connect to authentication server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section background="darker" className="pt-40 pb-20 min-h-screen flex items-center">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/10">
          <h1 className="font-display text-4xl text-white mb-2 text-center">Admin Access</h1>
          <p className="text-gray-400 text-center mb-8">Enter your passcode to manage the heritage.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Admin Passcode</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
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
              className="w-full bg-brand-gold text-black font-semibold py-3 rounded-xl hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Login to Dashboard'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 uppercase tracking-widest">
            Ahiajoku Heritage Protection
          </p>
        </div>
      </div>
    </Section>
  );
};
