import React, { useMemo, useState, useEffect } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { rotateRemotePasscode } from '../lib/remoteContent';
import { useNavigate } from 'react-router-dom';

const SESSION_KEY = 'heritage.admin.unlocked';
const PASSCODE_KEY = 'heritage.admin.passcode';
const REMEMBER_KEY = 'heritage.admin.rememberPasscode';

export const AdminPasscode: React.FC = () => {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(PASSCODE_KEY) || '';
  });
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isDev = Boolean((import.meta as any).env?.DEV);
  const writeUrl =
    ((import.meta as any).env?.VITE_CONTENT_WRITE_URL as string | undefined) || (isDev ? '/api/content' : '/api/content.php');

  const passcodeChangeUrl = useMemo(() => {
    if (!writeUrl) return '';
    try {
      const u = new URL(writeUrl, window.location.origin);
      if (u.pathname.endsWith('/api/content')) {
        u.pathname = u.pathname.replace(/\/api\/content$/, '/api/admin/passcode');
      } else if (u.pathname.endsWith('/api/content.php')) {
        u.pathname = u.pathname.replace(/\/api\/content\.php$/, '/api/admin/passcode.php');
      } else {
        u.pathname = '/api/admin/passcode.php';
      }
      return u.toString();
    } catch {
      return '';
    }
  }, [writeUrl]);

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const unlocked = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  }, []);

  useEffect(() => {
    if (!unlocked) {
      navigate('/admin');
    }
  }, [unlocked, navigate]);

  const handleChange = async () => {
    if (!passcodeChangeUrl) {
      setToast('No passcode URL configured');
      return;
    }
    const current = passcode.trim();
    const next = newPasscode.trim();
    const confirm = confirmPasscode.trim();

    if (!current) {
      setToast('Session expired. Please re-login.');
      navigate('/admin');
      return;
    }
    if (next.length < 8) {
      setToast('New passcode must be at least 8 characters');
      return;
    }
    if (next !== confirm) {
      setToast('Passcodes do not match');
      return;
    }

    try {
      setBusy(true);
      await rotateRemotePasscode(passcodeChangeUrl, current, next);
      
      // Update session
      window.sessionStorage.setItem(PASSCODE_KEY, next);
      if (window.localStorage.getItem(REMEMBER_KEY) === '1') {
        window.localStorage.setItem(PASSCODE_KEY, next);
      }
      setPasscode(next);
      setNewPasscode('');
      setConfirmPasscode('');
      setToast('Passcode changed successfully');
    } catch (e: any) {
      console.error(e);
      setToast(`Failed: ${e.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    'w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-gold-500 focus:outline-none transition-colors font-serif';
  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';

  if (!unlocked) return null;

  return (
    <Section background="darker" className="pt-40">
      <div className="max-w-xl mx-auto border border-white/5 bg-charcoal/60 backdrop-blur-sm p-12">
        <div className="flex justify-between items-center mb-8">
            <h1 className="font-display text-3xl text-white">Change Passcode</h1>
            <Button variant="ghost" onClick={() => navigate('/admin')}>Back</Button>
        </div>
        
        <p className="text-gray-400 mb-10 leading-relaxed font-light">
          Create a new secure passcode for the admin console. This will replace the current one immediately.
        </p>

        <div className="space-y-6">
          <div>
            <label className={labelClass}>New Passcode</label>
            <input
              className={fieldClass}
              type="password"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder="Min 8 chars"
            />
          </div>
          <div>
            <label className={labelClass}>Confirm New Passcode</label>
            <input
              className={fieldClass}
              type="password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              placeholder="Confirm new passcode"
            />
          </div>
          
          <div className="pt-4">
            <Button className="w-full" onClick={handleChange} disabled={busy || !newPasscode}>
              {busy ? 'Updating...' : 'Update Passcode'}
            </Button>
          </div>

          {message && <div className="text-gold-500 text-xs tracking-widest uppercase text-center">{message}</div>}
        </div>
      </div>
    </Section>
  );
};
