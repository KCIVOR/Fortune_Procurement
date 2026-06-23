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
    const initAuth = async () => {
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
