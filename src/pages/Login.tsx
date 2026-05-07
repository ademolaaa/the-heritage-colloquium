import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Section } from '../components/Section';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(''); // 2FA Token
  const [show2FA, setShow2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const body = show2FA ? { email, password, token } : { email, password };
      
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const json = await res.json();
      
      if (res.status === 403 && json.require2fa) {
        setShow2FA(true);
        setLoading(false);
        return;
      }
      
      if (json.ok) {
        login(json.token, json.user);
        navigate('/feed'); // Redirect to feed after login
      } else {
        setError(json.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section background="pattern" className="pt-32 pb-20 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-display text-primary mb-6 text-center">Sign In</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!show2FA ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Code (2FA)</label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary focus:border-transparent text-center tracking-widest text-lg"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Open your authenticator app and enter the code.
              </p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : (show2FA ? 'Verify Code' : 'Sign In')}
          </button>
        </form>
        
        <p className="mt-4 text-center text-gray-600 text-sm">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </Section>
  );
};
