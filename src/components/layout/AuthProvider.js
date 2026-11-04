'use client';
import { createContext, useContext, useMemo } from 'react';
import { hasPermission } from '@/lib/permissions/codes.mjs';

const AuthContext = createContext(null);

/** Receives the already-verified session from the server layout. UI-only: real checks happen on the server. */
export function AuthProvider({ value, children }) {
  const ctx = useMemo(() => ({ ...value, can: (needed) => hasPermission(value.permissions, needed) }), [value]);
  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
