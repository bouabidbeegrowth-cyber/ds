'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
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
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

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

  return <AppLayout />;
}