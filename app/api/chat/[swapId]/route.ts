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
import { rateLimit } from "@/lib/ratelimit";

// NOTE: chat is REST polling, not Socket.IO. Live push was removed (see
// lib/socket.ts) because Vercel serverless cannot run a Socket.IO server.
// The client (ChatPanel) polls this endpoint every few seconds.

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

    const messages = await prisma.chatMessage.findMany({
      where: { swapId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

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
    const rl = await rateLimit(req, "api-write");
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

    const message = await prisma.chatMessage.create({
      data: {
        swapId,
        senderId: user.id,
        text: text.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    return success(
      {
        id: message.id,
        swapId,
        senderId: user.id,
        senderName: user.name,
        senderAvatar: user.avatar,
        text: text.trim(),
        createdAt: message.createdAt,
      },
      201
    );
  } catch {
    return serverError();
  }
}
