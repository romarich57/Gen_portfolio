import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchCsrfToken, setCsrfToken as storeCsrfToken } from '@/api/csrf';
import { getMe } from '@/api/me';
import { logout as logoutRequest } from '@/api/auth';
import { setAuthErrorHandler } from '@/api/http';
import type { UserProfile } from '@/api/types';

export type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  csrfToken: string | null;
  refreshUser: () => Promise<UserProfile | null>;
  setUser: (user: UserProfile | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Bootstrap authentication state and CSRF token.
 * Preconditions: backend reachable.
 * Postconditions: provides auth context to children.
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await getMe();
      setUser(response.profile);
      return response.profile;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setAuthErrorHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const token = await fetchCsrfToken();
        if (active) {
          setCsrfToken(token);
          storeCsrfToken(token);
        }
      } catch {
        if (active) {
          setCsrfToken(null);
        }
      }

      try {
        const response = await getMe();
        if (active) {
          setUser(response.profile);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, csrfToken, refreshUser, setUser, logout }),
    [user, loading, csrfToken, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access auth context.
 * Preconditions: used within AuthBootstrap.
 * Postconditions: returns auth state and helpers.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthBootstrap');
  }
  return context;
}

export { AuthContext };
export default AuthBootstrap;
