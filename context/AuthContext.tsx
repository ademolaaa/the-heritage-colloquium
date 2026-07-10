import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'admin' | 'moderator';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  /** Call after a role change so the UI reflects the new role immediately */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  /**
   * Fetch the user's current profile from the server to get the live DB role.
   * Falls back to the Supabase session data if the API is unavailable.
   */
  const fetchUserProfile = async (token: string): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.ok || !data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email,
        username: data.user.username || data.user.email.split('@')[0],
        full_name: data.user.full_name || '',
        avatar_url: data.user.avatar_url || '',
        role: data.user.role || 'user',
      };
    } catch {
      return null;
    }
  };

  const applySession = async (sess: Session | null) => {
    setSession(sess);
    if (!sess?.access_token) {
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem('auth_token');
      return;
    }
    localStorage.setItem('auth_token', sess.access_token);

    // Primary: get role from our own DB via /api/auth/me
    const dbUser = await fetchUserProfile(sess.access_token);
    if (dbUser) {
      setUser(dbUser);
      setIsAdmin(dbUser.role === 'admin');
      return;
    }

    // Fallback: minimal user from Supabase session (role defaults to 'user')
    const su = sess.user;
    const fallback: User = {
      id: su.id,
      email: su.email || '',
      username: su.user_metadata?.username || (su.email || '').split('@')[0],
      full_name: su.user_metadata?.full_name || '',
      avatar_url: su.user_metadata?.avatar_url || '',
      role: 'user',
    };
    setUser(fallback);
    setIsAdmin(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session).finally(() => setIsLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true);
      applySession(session).finally(() => setIsLoading(false));
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Refresh user from DB — call this after a role change */
  const refreshUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const dbUser = await fetchUserProfile(token);
    if (dbUser) {
      setUser(dbUser);
      setIsAdmin(dbUser.role === 'admin');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAdmin(false);
  };

  const logout = signOut;

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signOut, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
