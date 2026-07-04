import { create } from 'zustand';
import type { Permissions } from '@/lib/permissions';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  name: string;
  roleId: string | null;
  roleName: string;
  permissions: Permissions;
  isSystemAdmin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updatePermissions: (permissions: Permissions, roleName: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ds_user', JSON.stringify(user));
      localStorage.setItem('ds_token', token);
    }
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ds_user');
      localStorage.removeItem('ds_token');
    }
    set({ user: null, token: null, isAuthenticated: false });
  },
  updatePermissions: (permissions, roleName) => {
    set((state) => ({
      user: state.user ? { ...state.user, permissions, roleName } : null,
    }));
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ds_user');
      if (stored) {
        const user = JSON.parse(stored);
        user.permissions = permissions;
        user.roleName = roleName;
        localStorage.setItem('ds_user', JSON.stringify(user));
      }
    }
  },
}));

let sessionWatcherInstalled = false;

// Any API call returning 401 while we believe we're logged in means the
// session died server-side (e.g. the 2h inactivity timeout) — log out
// client-side too instead of leaving the UI stuck with raw error banners.
function installSessionExpiryWatcher() {
  if (sessionWatcherInstalled || typeof window === 'undefined') return;
  sessionWatcherInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 401 && useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().logout();
      toast({
        title: 'Session expirée',
        description: 'Veuillez vous reconnecter.',
        variant: 'destructive',
      });
    }
    return response;
  };
}

export function initializeAuth() {
  if (typeof window === 'undefined') return;
  installSessionExpiryWatcher();
  const userStr = localStorage.getItem('ds_user');
  const token = localStorage.getItem('ds_token');
  if (userStr && token) {
    try {
      const user = JSON.parse(userStr);
      // Only accept stored data if it has the new permissions field
      // Old sessions (without permissions) need a server refresh
      if (user.permissions && typeof user.permissions === 'object') {
        useAuthStore.getState().login(user, token);
      } else {
        // Old format — clear stored user but keep token for refresh
        localStorage.removeItem('ds_user');
        // Set authenticated state with minimal data so page.tsx triggers refresh
        useAuthStore.setState({
          token,
          isAuthenticated: true,
          user: null,
        });
      }
    } catch {
      localStorage.removeItem('ds_user');
      localStorage.removeItem('ds_token');
    }
  }
}