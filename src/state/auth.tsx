import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { repository } from '@/data/local-repository';
import type { PublicUser } from '@/data/repository';

interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    repository
      .getSession()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await repository.signIn({ email, password }));
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setUser(await repository.signUp({ name, email, password }));
  }, []);

  const signOut = useCallback(async () => {
    await repository.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signUp, signOut }), [user, ready, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
