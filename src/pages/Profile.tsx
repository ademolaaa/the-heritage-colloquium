import React from 'react';
import { Section } from '../components/Section';
import { useAuth } from '../context/AuthContext';
import { TwoFactorSetup } from '../components/auth/TwoFactorSetup';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <div className="text-center pt-32 text-white">Please sign in to view profile.</div>;
  }

  return (
    <Section background="pattern" className="pt-32 pb-20">
      <div className="container mx-auto max-w-2xl px-6">
        <h1 className="font-display text-3xl text-white mb-8">Account Settings</h1>
        
        <div className="bg-charcoal/50 border border-white/10 p-6 rounded-sm mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 text-2xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl text-white font-medium">{user.username}</h2>
              <p className="text-gray-400">{user.email}</p>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-6">
            <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">
              Sign Out
            </button>
          </div>
        </div>

        <h2 className="font-display text-xl text-white mb-4">Security</h2>
        <TwoFactorSetup />
      </div>
    </Section>
  );
};
