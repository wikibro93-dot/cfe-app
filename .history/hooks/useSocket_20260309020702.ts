"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAppStore } from "@/store/appStore";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { WSNotification, WSSwapUpdate, WSChatMessage } from "@/lib/socket";

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

let globalSocket: Socket | null = null;

export function useSocket() {
  const { token, user, setNotificationCount, notificationCount } = useAppStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!token || !user) return;
    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      return;
    }

    const socket = io({
      path: "/api/ws",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      globalSocket = socket;
      socketRef.current = socket;
    });

    socket.on("notification:new", (notif: WSNotification) => {
      // Show toast for real-time notification
      const emoji =
        notif.type === "SWAP_REQUEST" ? "🔄" :
        notif.type === "SWAP_CONFIRMED" ? "✅" :
        notif.type === "PICKUP_CONFIRMED" ? "🎉" : "🔔";

      toast(`${emoji} ${notif.title}\n${notif.body}`, {
        duration: 5000,
        style: {
          background: "#14532d",
          color: "#dcfce7",
          maxWidth: "340px",
        },
      });

      setNotificationCount(notificationCount + 1);

      // Invalidate notifications cache
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    socket.on("swap:updated", (update: WSSwapUpdate) => {
      queryClient.invalidateQueries({ queryKey: ["swaps"] });
      queryClient.invalidateQueries({ queryKey: ["swap", update.swapId] });
    });

    socket.on("dish:new", () => {
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    });

    socket.on("connect_error", () => {
      // Silently fail — app works without WS
    });

    socket.on("disconnect", () => {
      globalSocket = null;
    });

    return () => {
      socket.disconnect();
      globalSocket = null;
    };
  }, [token, user?.id]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  const joinSwap = useCallback((swapId: string) => {
    socketRef.current?.emit("join:swap", swapId);
  }, []);

  const leaveSwap = useCallback((swapId: string) => {
    socketRef.current?.emit("leave:swap", swapId);
  }, []);

  const subscribeToChat = useCallback(
    (swapId: string, handler: (msg: WSChatMessage) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on("chat:message", handler);
      return () => socket.off("chat:message", handler);
    },
    []
  );

  return {
    socket: socketRef.current,
    joinSwap,
    leaveSwap,
    subscribeToChat,
    isConnected: !!socketRef.current?.connected,
  };
}
