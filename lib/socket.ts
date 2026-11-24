import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifyToken } from "@/lib/jwt";

let io: SocketIOServer | null = null;

// Room naming convention:
//   user:{userId}      — personal notifications
//   swap:{swapId}      — swap-specific updates
//   chat:{swapId}      — chat messages for a swap

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: "/api/ws",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error("Invalid token"));
    }
    (socket as any).userId = payload.userId;
    (socket as any).userRole = payload.role;
    next();
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as string;

    // Auto-join personal room
    socket.join(`user:${userId}`);

    socket.on("join:swap", (swapId: string) => {
      socket.join(`swap:${swapId}`);
      socket.join(`chat:${swapId}`);
    });

    socket.on("leave:swap", (swapId: string) => {
      socket.leave(`swap:${swapId}`);
      socket.leave(`chat:${swapId}`);
    });

    socket.on("disconnect", () => {
      // cleanup handled automatically by socket.io
    });
  });

  console.log("✅ Socket.IO server initialized");
  return io;
}

// ── Emit helpers ─────────────────────────────────────────────────────────────

export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToSwap(swapId: string, event: string, data: unknown) {
  io?.to(`swap:${swapId}`).emit(event, data);
}

export function emitChatMessage(swapId: string, message: unknown) {
  io?.to(`chat:${swapId}`).emit("chat:message", message);
}

export function emitNewDish(dish: unknown) {
  // broadcast to all connected users (hot-dish alert)
  io?.emit("dish:new", dish);
}

// ── Typed event payloads ──────────────────────────────────────────────────────

export interface WSNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface WSSwapUpdate {
  swapId: string;
  status: string;
  updatedAt: string;
}

export interface WSChatMessage {
  id: string;
  swapId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: string;
}
