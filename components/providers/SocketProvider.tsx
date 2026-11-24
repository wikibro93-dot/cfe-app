"use client";

import { useSocket } from "@/hooks/useSocket";

// This component just mounts the socket hook at the app level,
// so the connection is established as soon as the user logs in.
export function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket(); // establishes connection, sets up global listeners
  return <>{children}</>;
}
