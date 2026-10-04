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
      try {
        return await api.get<{ authenticated: boolean; user: User | null }>('/api/auth/me');
      } catch {
        return { authenticated: false, user: null };
      }
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

  // Google OAuth redirect
  const loginWithGoogle = useCallback((returnTo: string = '/overview') => {
    setAuthError(null);
    const target = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
    window.location.href = `/api/auth/google/login?return_to=${encodeURIComponent(target)}`;
  }, []);

  // Developer operator login
  const devLoginMutation = useMutation({
    mutationFn: async ({ name, email }: { name?: string; email?: string }) => {
      return api.post<{ authenticated: boolean; user: User }>('/api/auth/dev-login', {
        name: name || 'Advay Chavan',
        email: email || 'advay@halfabyte.ai',
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth-me'], data);
      setIsAuthModalOpen(false);
      setAuthError(null);
    },
    onError: (err: any) => {
      setAuthError(err.message || 'Developer login failed');
    },
  });

  const devLogin = useCallback(async (name?: string, email?: string): Promise<boolean> => {
    try {
      await devLoginMutation.mutateAsync({ name, email });
      return true;
    } catch {
      return false;
    }
  }, [devLoginMutation]);

  // Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ ok: boolean }>('/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth-me'], { authenticated: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

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
