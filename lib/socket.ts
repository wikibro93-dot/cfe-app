/**
 * Socket.IO was REMOVED (fix/critical-security).
 *
 * The server (`initSocketServer`) had zero callers — there is no custom
 * server and no /api/ws route, and Vercel serverless cannot run a
 * long-lived Socket.IO server. Every emit was a no-op, the client silently
 * swallowed connect errors, and `join:swap` had no membership check, so
 * any connected socket could join any swap room. Keeping the code would
 * keep pretending live push works.
 *
 * Chat and notifications now use REST polling (see ChatPanel). This file
 * keeps only the shared message/notification types so existing type
 * imports keep compiling.
 */

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
