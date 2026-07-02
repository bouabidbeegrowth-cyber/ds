'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuthStore, initializeAuth } from '@/store/auth-store';
import { LoginForm } from '@/components/modules/login-form';
import { AppLayout } from '@/components/layout/app-layout';

function useMounted() {
  return useSyncExternalStore(
    (cb) => { cb(); return () => {}; },
    () => true,
    () => false
  );
}

export default function Home() {
  const mounted = useMounted();
  const { isAuthenticated, user, login, token } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Initialize auth from localStorage
  useEffect(() => {
    initializeAuth();
  }, []);

  // Refresh user data to get latest permissions (in case of role changes)
  useEffect(() => {
    if (!isAuthenticated || !token || !user) return;
    // If user already has permissions, no need to refresh
    if (user.permissions && Object.keys(user.permissions).length > 0) return;

    const fetchMe = async () => {
      setRefreshing(true);
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            login(data.user, token);
          } else {
            // Session invalid, logout
            useAuthStore.getState().logout();
          }
        } else {
          useAuthStore.getState().logout();
        }
      } catch {
        // Don't logout on network error, keep existing session
      } finally {
        setRefreshing(false);
      }
    };

    fetchMe();
  }, [isAuthenticated, token, user, login]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/ds-logo.png" alt="DS" className="w-24 h-24 mx-auto mb-4 rounded-full" />
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (refreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/ds-logo.png" alt="DS" className="w-24 h-24 mx-auto mb-4 rounded-full" />
          <div className="animate-pulse text-muted-foreground">Chargement des permissions...</div>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}