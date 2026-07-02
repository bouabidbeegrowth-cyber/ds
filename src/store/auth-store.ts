import { create } from 'zustand';
import type { Permissions } from '@/lib/permissions';

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

export function initializeAuth() {
  if (typeof window === 'undefined') return;
  const userStr = localStorage.getItem('ds_user');
  const token = localStorage.getItem('ds_token');
  if (userStr && token) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.getState().login(user, token);
    } catch {
      localStorage.removeItem('ds_user');
      localStorage.removeItem('ds_token');
    }
  }
}