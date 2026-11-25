import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden, success, badRequest, serverError } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

// Socket.IO live push was removed (see lib/socket.ts). Buyer location is
// now stored on the Swap (buyerLat / buyerLng / buyerLocationAt) and the
// cook polls GET on this route every few seconds (see
// app/swaps/[id]/track/page.tsx). No notification is created per broadcast
// — the buyer broadcasts every 4 seconds, so a notification per broadcast
// would flood the cook with hundreds of rows.

async function loadSwap(swapId: string) {
  return prisma.swap.findUnique({ where: { id: swapId } });
}

function isParticipant(swap: { buyerId: string; cookId: string }, userId: string) {
  return swap.buyerId === userId || swap.cookId === userId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await rateLimit(req, "api-search");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id: swapId } = await params;
    const swap = await loadSwap(swapId);
    if (!swap) return badRequest("Swap not found");
    if (!isParticipant(swap, user.id)) return forbidden("Not a participant of this swap");

    if (swap.buyerLat == null || swap.buyerLng == null) {
      return success({ location: null, timestamp: null, message: "No location shared yet" });
    }

    return success({
      location: { lat: swap.buyerLat, lng: swap.buyerLng },
      timestamp: swap.buyerLocationAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Get buyer location error:", error);
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id: swapId } = await params;
    const { lat, lng } = await req.json();

    // Validate coordinates
    if (typeof lat !== "number" || typeof lng !== "number") {
      return badRequest("Latitude and longitude are required");
    }

    // Validate coordinates are within reasonable bounds
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return badRequest("Invalid coordinates");
    }

    // Find the swap
    const swap = await prisma.swap.findUnique({
      where: { id: swapId },
      include: { dish: true, buyer: true, cook: true },
    });

    if (!swap) {
      return badRequest("Swap not found");
    }

    // Only buyer can broadcast their location
    if (swap.buyerId !== user.id) {
      return forbidden("Only buyer can broadcast their location");
    }

    // Only broadcast for confirmed or later status swaps
    if (!["CONFIRMED", "PICKED_UP", "COMPLETED"].includes(swap.status)) {
      return badRequest("Location tracking is only available for confirmed swaps");
    }

    // Store the latest location on the swap so the cook can poll it.
    // (Previously this created one notification per broadcast — every
    // 4 seconds — and relied on a Socket.IO server that never ran.)
    await prisma.swap.update({
      where: { id: swap.id },
      data: { buyerLat: lat, buyerLng: lng, buyerLocationAt: new Date() },
    });

    return success({
      message: "Location shared with cook",
      location: { lat, lng },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Broadcast buyer location error:", error);
    return serverError();
  }
}
