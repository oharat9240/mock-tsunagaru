import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "admin" | "user";
  createdAt: string; // Changed to string for JSON serialization
  updatedAt: string; // Changed to string for JSON serialization
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const userAtom = atomWithStorage<User | null>("tsunagaru-user", null);

export const isAuthenticatedAtom = atom<boolean>((get) => {
  const user = get(userAtom);
  return user !== null;
});

export const authStateAtom = atom<AuthState>((get) => {
  const user = get(userAtom);
  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
  };
});

export const loginAtom = atom(null, (_get, set, user: User) => {
  set(userAtom, user);
});

export const logoutAtom = atom(null, (_get, set) => {
  set(userAtom, null);
});
