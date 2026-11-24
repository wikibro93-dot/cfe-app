import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden, success, badRequest, serverError } from "@/lib/middleware";
import { emitToUser } from "@/lib/socket";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Broadcast location to cook via WebSocket
    emitToUser(swap.cookId, "buyer:location", {
      swapId: swap.id,
      dishId: swap.dishId,
      buyerId: user.id,
      buyerName: user.name,
      buyerPhone: user.phone,
      location: { lat, lng },
      timestamp: new Date().toISOString(),
      status: swap.status,
    });

    // Create notification for cook
    await prisma.notification.create({
      data: {
        userId: swap.cookId,
        swapId: swap.id,
        type: "BUYER_LOCATION_UPDATE",
        title: "📍 Buyer Location Updated",
        body: `${user.name} is on their way to pick up "${swap.dish.title}"`,
        data: {
          dishId: swap.dishId,
          buyerId: user.id,
          buyerName: user.name,
          location: { lat, lng },
        },
      },
    });

    return success({
      message: "Location broadcasted to cook",
      location: { lat, lng },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Broadcast buyer location error:", error);
    return serverError();
  }
}
