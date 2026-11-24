"use client";

import { useCallback } from "react";
import type { WSChatMessage } from "@/lib/socket";

/**
 * No-op compatibility stub (fix/critical-security). Socket.IO live push
 * was removed — see lib/socket.ts. The hook keeps the same API so existing
 * components keep working; live updates now come from REST polling
 * (ChatPanel polls /api/chat/[swapId]) and in-app notifications.
 */

export interface BuyerLocationUpdate {
  swapId: string;
  dishId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  location: { lat: number; lng: number };
  timestamp: string;
  status: string;
}

export function useSocket() {
  const joinSwap = useCallback((_swapId: string) => {}, []);
  const leaveSwap = useCallback((_swapId: string) => {}, []);
  const subscribeToChat = useCallback(
    (_swapId: string, _handler: (msg: WSChatMessage) => void) => () => {},
    []
  );
  const subscribeToLocation = useCallback(
    (_handler: (update: BuyerLocationUpdate) => void) => () => {},
    []
  );

  return {
    socket: null,
    joinSwap,
    leaveSwap,
    subscribeToChat,
    subscribeToLocation,
    isConnected: false,
  };
}
