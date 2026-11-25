"use client";

/**
 * Passthrough (fix/critical-security). Socket.IO live push was removed —
 * see lib/socket.ts — so this provider no longer opens a connection. It
 * is kept as a passthrough so app/providers.tsx needs no changes.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
