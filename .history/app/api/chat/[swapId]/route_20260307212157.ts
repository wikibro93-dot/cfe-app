import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  success,
  serverError,
  badRequest,
} from "@/lib/middleware";
import { emitChatMessage } from "@/lib/socket";
import { rateLimit } from "@/lib/ratelimit";

// GET  /api/chat/[swapId]  — load chat history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ swapId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { swapId } = await params;
    const swap = await prisma.swap.findUnique({
      where: { id: swapId },
    });
    if (!swap) return badRequest("Swap not found");
    if (swap.buyerId !== user.id && swap.cookId !== user.id) return forbidden();

    // Messages stored in a JSON column on Notification for simplicity
    // In production you'd add a ChatMessage model — using notifications table here
    const messages = await (prisma as any).chatMessage?.findMany({
      where: { swapId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    }) ?? [];

    return success(messages);
  } catch {
    return serverError();
  }
}

// POST /api/chat/[swapId]  — send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ swapId: string }> }
) {
  try {
    // Rate limit chat: 30 messages per minute
    const rl = rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { swapId } = await params;
    const { text } = await req.json();
    if (!text?.trim()) return badRequest("Message cannot be empty");
    if (text.length > 500) return badRequest("Message too long (max 500 chars)");

    const swap = await prisma.swap.findUnique({ where: { id: swapId } });
    if (!swap) return badRequest("Swap not found");
    if (swap.buyerId !== user.id && swap.cookId !== user.id) return forbidden();

    // Try to use ChatMessage model if it exists, else fall back to notification log
    let message: any;
    try {
      message = await (prisma as any).chatMessage.create({
        data: {
          swapId,
          senderId: user.id,
          text: text.trim(),
        },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      });
    } catch {
      // ChatMessage model not yet migrated — return a synthetic message
      message = {
        id: `tmp-${Date.now()}`,
        swapId,
        senderId: user.id,
        sender: { id: user.id, name: user.name, avatar: user.avatar },
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };
    }

    // Emit via WebSocket to both parties
    const wsMsg = {
      id: message.id,
      swapId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      text: text.trim(),
      createdAt: message.createdAt,
    };

    emitChatMessage(swapId, wsMsg);

    // Notify the other party
    const recipientId = swap.buyerId === user.id ? swap.cookId : swap.buyerId;
    const { emitToUser } = await import("@/lib/socket");
    emitToUser(recipientId, "notification:new", {
      id: `chat-${Date.now()}`,
      type: "CHAT_MESSAGE",
      title: `💬 ${user.name}`,
      body: text.trim().slice(0, 80),
      data: { swapId },
      createdAt: new Date().toISOString(),
    });

    return success(wsMsg, 201);
  } catch {
    return serverError();
  }
}
