'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import { shouldReloadProfile, shouldReplaceSession } from '@/lib/auth-state-update';
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
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    const clearAuth = () => {
      sessionRef.current = null;
      profileRef.current = null;
      setSession(null);
      setProfile(null);
    };

    const applyAuth = async (incoming: Session | null) => {
      const incomingUserId = incoming?.user?.id ?? null;
      const currentUserId = sessionRef.current?.user?.id ?? null;

      if (!incoming || !incomingUserId) {
        if (sessionRef.current || profileRef.current) clearAuth();
        return;
      }

      if (shouldReplaceSession(incoming.access_token, sessionRef.current?.access_token)) {
        sessionRef.current = incoming;
        setSession(incoming);
      }

      if (!shouldReloadProfile({
        incomingUserId,
        currentUserId,
        hasProfile: !!profileRef.current,
      })) {
        return;
      }

      const p = await loadProfileOrSignOut(incomingUserId);
      if (sessionRef.current?.user?.id !== incomingUserId) return;

      if (!p) {
        clearAuth();
        return;
      }

      profileRef.current = p;
      setProfile(p);
    };

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await applyAuth(session);
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyAuth(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionRef.current = null;
    profileRef.current = null;
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) return;
    const p = await loadProfileOrSignOut(currentSession.user.id);
    if (!p) {
      sessionRef.current = null;
      profileRef.current = null;
      setSession(null);
      setProfile(null);
      return;
    }
    profileRef.current = p;
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
