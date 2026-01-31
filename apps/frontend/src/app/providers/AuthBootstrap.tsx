import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { fetchCsrfToken, setCsrfToken as storeCsrfToken } from '@/api/csrf';
import { getMe } from '@/api/me';
import { logout as logoutRequest } from '@/api/auth';
import { setAuthErrorHandler } from '@/api/http';
import type { ApiError } from '@/api/http';
import type { UserProfile } from '@/api/types';
import { useToast } from '@/components/common/ToastProvider';

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
  const { showToast } = useToast();
  const initErrorShownRef = useRef(false);

  const showInitErrorOnce = useCallback(
    (message: string) => {
      if (initErrorShownRef.current) return;
      initErrorShownRef.current = true;
      showToast(message, 'error');
    },
    [showToast]
  );

  const refreshUser = useCallback(async () => {
    try {
      const response = await getMe();
      setUser(response.profile);
      return response.profile;
    } catch (err) {
      setUser(null);
      const apiError = err as ApiError;
      if (apiError?.status === 401 || apiError?.code === 'AUTH_REQUIRED') {
        return null;
      }
      throw err;
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
          showInitErrorOnce('Impossible de contacter le serveur.');
        }
      }

      try {
        const response = await getMe();
        if (active) {
          setUser(response.profile);
        }
      } catch (err) {
        if (active) {
          setUser(null);
          const apiError = err as ApiError;
          if (apiError?.code && apiError.code !== 'AUTH_REQUIRED') {
            showInitErrorOnce('Impossible de charger la session.');
          }
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
  }, [showInitErrorOnce]);

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
