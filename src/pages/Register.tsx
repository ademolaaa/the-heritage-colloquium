import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Section } from '../components/Section';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Password Strength State
  const [strength, setStrength] = useState(0);
  const [feedback, setFeedback] = useState<string[]>([]);

  useEffect(() => {
    let score = 0;
    const msgs: string[] = [];
    
    if (password.length >= 8) score++;
    else msgs.push("At least 8 characters");

    if (/[A-Z]/.test(password)) score++;
    else msgs.push("One uppercase letter");

    if (/[a-z]/.test(password)) score++;
    else msgs.push("One lowercase letter");

    if (/\d/.test(password)) score++;
    else msgs.push("One number");

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else msgs.push("One special character");

    setStrength(score);
    setFeedback(msgs);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strength < 5) {
      setError('Please meet all password requirements.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      
      const json = await res.json();
      
      if (json.ok) {
        login(json.token, json.user);
        navigate('/feed'); // Redirect to feed after registration
      } else {
        setError(json.error || 'Registration failed');
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
        <h1 className="text-3xl font-display text-primary mb-6 text-center">Create Account</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

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
            {/* Password Strength Indicator */}
            <div className="mt-2">
              <div className="flex h-1 gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className={`h-full flex-1 rounded transition-colors ${
                      i <= strength 
                        ? (strength < 3 ? 'bg-red-400' : strength < 5 ? 'bg-yellow-400' : 'bg-green-500') 
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {feedback.length > 0 && (
                <ul className="text-xs text-gray-500 mt-2 list-disc pl-4">
                  {feedback.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || strength < 5}
            className="w-full bg-primary text-white py-2 rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <p className="mt-4 text-center text-gray-600 text-sm">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </Section>
  );
};
