import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId: string;
  tenantName?: string;
}

function normalizeUser(user: User): User {
  const rawDisplayName = user.displayName?.trim();
  const parts = rawDisplayName ? rawDisplayName.split(/\s+/).filter(Boolean) : [];

  const firstName = user.firstName?.trim() || parts[0] || user.username || '';
  const lastName = user.lastName?.trim() || parts.slice(1).join(' ');

  return {
    ...user,
    displayName: rawDisplayName || [firstName, lastName].filter(Boolean).join(' ').trim() || user.username,
    firstName,
    lastName,
    email: user.email || user.username,
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user: normalizeUser(user), isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'senic-auth-storage', // Key in localStorage
    }
  )
);
