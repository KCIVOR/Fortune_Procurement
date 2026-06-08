'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import type { UserProfile } from '@/types/auth';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

async function loadProfileOrSignOut(userId: string): Promise<UserProfile | null> {
  const p = await fetchUserProfile(userId);
  if (p && p.active === false) {
    await supabase.auth.signOut();
    return null;
  }
  return p;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if this is a temporary session (Remember Me was not checked)
    // If tempSession flag exists and page is being loaded fresh, sign out
    const checkTempSession = async () => {
      // Skip the temp session check on auth callback pages (invite/reset/etc)
      // These pages handle their own session establishment from email links
      const pathname = window.location.pathname;
      const isAuthCallbackPage = 
        pathname.startsWith('/invite/') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/forgot-password');
      
      if (isAuthCallbackPage) {
        return false;
      }

      // Skip if URL contains auth tokens (PKCE code or implicit flow tokens)
      const hasAuthParams = 
        window.location.search.includes('code=') ||
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('refresh_token=');
      
      if (hasAuthParams) {
        return false;
      }

      const isTempSession = sessionStorage.getItem('tempSession') === 'true';
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      
      // If session was marked as temporary but sessionStorage was cleared (browser restart),
      // we need to sign out. We detect this by checking if there's a session but no tempSession flag
      // and no rememberMe flag.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession && !rememberMe && !isTempSession) {
        // Browser was closed and reopened without "Remember Me"
        // Sign out the user
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setLoading(false);
        return true;
      }
      return false;
    };

    const initAuth = async () => {
      const wasSignedOut = await checkTempSession();
      if (wasSignedOut) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const p = await loadProfileOrSignOut(session.user.id);
        if (!p) {
          setSession(null);
          setProfile(null);
        } else {
          setSession(session);
          setProfile(p);
        }
      } else {
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        (async () => {
          const p = await loadProfileOrSignOut(session.user.id);
          if (!p) {
            setSession(null);
            setProfile(null);
          } else {
            setSession(session);
            setProfile(p);
          }
        })();
      } else {
        setSession(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear remember me preferences on explicit sign out
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('tempSession');
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) return;
    const p = await loadProfileOrSignOut(currentSession.user.id);
    if (!p) {
      setSession(null);
      setProfile(null);
      return;
    }
    setProfile(p);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
