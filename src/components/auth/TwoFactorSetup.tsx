import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const TwoFactorSetup: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<'initial' | 'qr' | 'verify'>('initial');
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/setup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const json = await res.json();
      if (json.ok) {
        setQrCode(json.qrCode);
        setStep('qr');
      } else {
        setError('Failed to start setup');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ token })
      });
      const json = await res.json();
      if (json.ok) {
        updateUser({ ...user, two_factor_enabled: true });
        setStep('initial');
        alert('2FA Enabled Successfully!');
      } else {
        setError('Invalid token');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-charcoal/50 border border-white/10 p-6 rounded-sm">
      <h3 className="text-xl font-display text-white mb-4">Two-Factor Authentication</h3>
      
      {user.two_factor_enabled ? (
        <div className="flex items-center gap-2 text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Enabled and Secure</span>
        </div>
      ) : (
        <div>
          {step === 'initial' && (
            <div>
              <p className="text-gray-400 mb-4">Add an extra layer of security to your account.</p>
              <Button onClick={startSetup} disabled={loading}>Enable 2FA</Button>
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-4">
              <p className="text-gray-300">1. Scan this QR code with Google Authenticator or Authy.</p>
              <img src={qrCode} alt="2FA QR Code" className="bg-white p-2 rounded" />
              
              <p className="text-gray-300">2. Enter the 6-digit code below.</p>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="000000"
                className="bg-black/50 border border-white/10 px-4 py-2 text-white text-center tracking-widest"
              />
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              <div className="flex gap-2">
                <Button onClick={verifyToken} disabled={loading}>Verify & Enable</Button>
                <Button variant="ghost" onClick={() => setStep('initial')}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
