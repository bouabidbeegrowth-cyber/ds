import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
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