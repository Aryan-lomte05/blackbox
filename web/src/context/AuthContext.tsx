import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
}

export interface AuthStatus {
  google_configured: boolean;
  mongodb: {
    configured: boolean;
    connected: boolean;
    mode: string;
  };
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  authModalReturnTo: string;
  authStatus: AuthStatus | null;
  loginWithGoogle: (returnTo?: string) => void;
  devLogin: (name?: string, email?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  openAuthModal: (returnTo?: string) => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
}

export const DEFAULT_OPERATOR: User = {
  id: 'usr_developer:dev_operator_001',
  name: 'Demo Operator',
  email: 'operator@localhost',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=BlackBoxOperator',
  provider: 'developer',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReturnTo, setAuthModalReturnTo] = useState('/overview');

  // Check for auth_error URL parameter upon OAuth redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('auth_error');
      if (err) {
        setAuthError(decodeURIComponent(err));
        // Clean URL without reloading
        params.delete('auth_error');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, '', `${window.location.pathname}${newSearch}`);
      }
    }
  }, []);

  // Fetch current authenticated user session
  const { data: meData, isLoading } = useQuery<{ authenticated: boolean; user: User | null }>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      // 1. Check live backend authentication session
      try {
        const res = await api.get<{ authenticated: boolean; user: User | null }>('/api/auth/me');
        if (res && res.authenticated) {
          return res;
        }
      } catch {
        // Backend auth offline or 404
      }

      // 2. Check local operator session storage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('blackbox_dev_auth');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.authenticated) {
              return parsed;
            }
          } catch {
            localStorage.removeItem('blackbox_dev_auth');
          }
        }

        // 3. Unless the user explicitly clicked "Sign Out", default to active operator identity
        const explicitlyLoggedOut = localStorage.getItem('blackbox_logged_out');
        if (!explicitlyLoggedOut) {
          const defaultSession = { authenticated: true, user: DEFAULT_OPERATOR };
          localStorage.setItem('blackbox_dev_auth', JSON.stringify(defaultSession));
          return defaultSession;
        }
      }

      return { authenticated: false, user: null };
    },
    staleTime: 60000,
    retry: false,
  });

  // Fetch OAuth & MongoDB operational status
  const { data: authStatus } = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: async () => {
      try {
        return await api.get<AuthStatus>('/api/auth/status');
      } catch {
        return {
          google_configured: false,
          mongodb: { configured: false, connected: false, mode: 'memory_fallback' },
        };
      }
    },
    staleTime: 120000,
  });

  const user = meData?.authenticated ? meData.user : null;
  const isAuthenticated = !!user;

  // Developer operator login (resilient & instant)
  const devLogin = useCallback(async (name?: string, email?: string): Promise<boolean> => {
    const operatorUser: User = {
      id: 'usr_developer:dev_operator_001',
      name: name || 'Demo Operator',
      email: email || 'operator@localhost',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=BlackBoxOperator',
      provider: 'developer',
    };
    const session = { authenticated: true, user: operatorUser };

    // Clear explicit logged out flag
    if (typeof window !== 'undefined') {
      localStorage.removeItem('blackbox_logged_out');
      localStorage.setItem('blackbox_dev_auth', JSON.stringify(session));
    }

    queryClient.setQueryData(['auth-me'], session);
    setIsAuthModalOpen(false);
    setAuthError(null);

    // Try posting to backend so session cookie is also set if server is online
    try {
      const serverRes = await api.post<{ authenticated: boolean; user: User }>('/api/auth/dev-login', {
        name: operatorUser.name,
        email: operatorUser.email,
        avatar: operatorUser.avatar,
      });
      if (serverRes && serverRes.authenticated) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('blackbox_dev_auth', JSON.stringify(serverRes));
        }
        queryClient.setQueryData(['auth-me'], serverRes);
      }
    } catch {
      // Local fallback stays active silently with zero disruption
    }

    return true;
  }, [queryClient]);

  // Google OAuth redirect with fallback
  const loginWithGoogle = useCallback((returnTo: string = '/overview') => {
    setAuthError(null);
    const target = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;

    // If Google OAuth is not configured on the backend, activate operator mode seamlessly
    if (authStatus && !authStatus.google_configured) {
      devLogin('Demo Operator', 'operator@localhost').then(() => {
        if (typeof window !== 'undefined') {
          window.location.href = target;
        }
      });
      return;
    }

    window.location.href = `/api/auth/google/login?return_to=${encodeURIComponent(target)}`;
  }, [authStatus, devLogin]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await api.post<{ ok: boolean }>('/api/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('blackbox_dev_auth');
      localStorage.setItem('blackbox_logged_out', 'true');
    }
    queryClient.setQueryData(['auth-me'], { authenticated: false, user: null });
    queryClient.invalidateQueries({ queryKey: ['auth-me'] });
  }, [queryClient]);

  const openAuthModal = useCallback((returnTo: string = '/overview') => {
    setAuthModalReturnTo(returnTo);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);


  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        authError,
        isAuthModalOpen,
        authModalReturnTo,
        authStatus: authStatus || null,
        loginWithGoogle,
        devLogin,
        logout,
        openAuthModal,
        closeAuthModal,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
