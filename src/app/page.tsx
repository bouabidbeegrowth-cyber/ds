'use client';

import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { useAuthStore, initializeAuth } from '@/store/auth-store';
import { LoginForm } from '@/components/modules/login-form';
import { AppLayout } from '@/components/layout/app-layout';
import { ALL_MODULES } from '@/lib/permissions';

function useMounted() {
  return useSyncExternalStore(
    (cb) => { cb(); return () => {}; },
    () => true,
    () => false
  );
}

export default function Home() {
  const mounted = useMounted();
  const { isAuthenticated, user, login, token, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Initialize auth from localStorage
  useEffect(() => {
    initializeAuth();
  }, []);

  // Refresh user data to get latest permissions
  const refreshPermissions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          login(data.user, token);
          setLoading(false);
          return;
        }
      }
      // Session invalid, logout
      logout();
    } catch {
      // Don't logout on network error — but stop loading to avoid infinite spinner
    } finally {
      setLoading(false);
    }
  }, [token, login, logout]);

  useEffect(() => {
    if (!mounted) return;

    // Not authenticated at all — show login
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    // Authenticated with valid, up-to-date permissions — ready
    const hasAllModules = ALL_MODULES.every((mod) => user?.permissions?.[mod] !== undefined);
    if (user?.permissions && hasAllModules) {
      setLoading(false);
      return;
    }

    // Authenticated but permissions missing or stale (old session, or a module
    // was added since this session's cached data was stored) — refresh from server
    refreshPermissions();
  }, [mounted, isAuthenticated, token, user, refreshPermissions]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-neutral-900 flex items-center justify-center">
            <img src="/ds-logo.png" alt="Maison Lellethom" className="w-[78%] h-[78%] object-contain" />
          </div>
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <AppLayout />;
}