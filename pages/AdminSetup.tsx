import React, { useEffect, useState } from 'react';
import { Section } from '../components/Section';
import { useNavigate } from 'react-router-dom';

/**
 * AdminSetup — First-time bootstrap page.
 * Visible only when NO admin exists in the database.
 * Once an admin exists this page returns 403 and redirects to login.
 */
export const AdminSetup: React.FC = () => {
  const navigate = useNavigate();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Check if any admin already exists
  useEffect(() => {
    fetch('/api/v1/admin/check-setup')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasAdmin) {
          // Already configured — redirect away
          navigate('/login');
        } else {
          setHasAdmin(false);
        }
      })
      .catch(() => setHasAdmin(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !setupToken) return;
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, setupToken }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.error || 'Setup failed' });
        return;
      }

      setMessage({ type: 'success', text: `✓ Admin access granted to ${email}. Redirecting to login…` });
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      setMessage({ type: 'error', text: 'Network error. Is the server running?' });
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    'w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-gold-500 focus:outline-none transition-colors rounded-lg';
  const labelClass = 'block text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-2 font-semibold';

  if (hasAdmin === null) {
    return (
      <Section background="darker" className="pt-40 min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Checking system status…</p>
      </Section>
    );
  }

  return (
    <Section background="darker" className="pt-40 pb-20 min-h-screen flex items-center">
      <div className="container mx-auto px-6">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 border border-gold-500/20 mb-6">
              <span className="text-2xl">🔑</span>
            </div>
            <h1 className="font-display text-4xl text-white mb-3">Admin Setup</h1>
            <p className="text-gray-400 leading-relaxed">
              Promote your account to admin. This page works only once — once an admin exists,
              it permanently closes.
            </p>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8">
            {/* Security callout */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-8 text-amber-400 text-sm leading-relaxed">
              <strong className="block mb-1">How this works</strong>
              Enter the <code className="bg-white/10 px-1 rounded">ADMIN_PASSCODE</code> from your{' '}
              server <code className="bg-white/10 px-1 rounded">.env</code> file as the Setup Token.
              You only need to do this once — after that, manage all admin roles from inside the
              admin console.
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className={labelClass}>Your Email Address</label>
                <input
                  type="email"
                  className={fieldClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-gray-600 text-xs mt-1">
                  Must match an existing registered account.
                </p>
              </div>

              <div>
                <label className={labelClass}>Setup Token</label>
                <input
                  type="password"
                  className={fieldClass}
                  placeholder="Paste your ADMIN_PASSCODE here"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  required
                  autoComplete="off"
                />
                <p className="text-gray-600 text-xs mt-1">
                  This is the <code>ADMIN_PASSCODE</code> value from your server environment.
                </p>
              </div>

              {message && (
                <div
                  className={`px-4 py-3 rounded-lg text-sm ${
                    message.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !email || !setupToken}
                className="w-full bg-gold-500 hover:bg-white text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Setting up…' : 'Grant Admin Access'}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-600 text-xs mt-6">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-gray-500 hover:text-gold-500 underline transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </Section>
  );
};
