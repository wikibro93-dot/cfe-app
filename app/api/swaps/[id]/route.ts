import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, notFound, success, serverError, badRequest, forbidden } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

// NOTE: live Socket.IO push was removed (see lib/socket.ts) — Vercel
// serverless cannot run a long-lived Socket.IO server, and the emit calls
// below were no-ops. State changes are delivered via in-app notifications
// and REST polling instead.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const swap = await prisma.swap.findUnique({
      where: { id },
      include: {
        dish: true,
        buyer: { select: { id: true, name: true, avatar: true, phone: true } },
        cook: { select: { id: true, name: true, avatar: true, phone: true } },
        rating: true,
      },
    });

    if (!swap) return notFound("Swap not found");
    if (swap.buyerId !== user.id && swap.cookId !== user.id && user.role !== "ADMIN") {
      return forbidden();
    }

    return success(swap);
  } catch (error) {
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const { action, cancelReason, score, comment } = await req.json();

    const swap = await prisma.swap.findUnique({
      where: { id },
      include: { dish: true, buyer: true, cook: true, rating: true },
    });

    if (!swap) return notFound("Swap not found");

    switch (action) {
      case "confirm": {
        // Only cook can confirm
        if (swap.cookId !== user.id) return forbidden();
        if (swap.status !== "PENDING") return badRequest("Swap is not pending");

        await prisma.swap.update({
          where: { id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });

        await prisma.notification.create({
          data: {
            userId: swap.buyerId,
            type: "SWAP_CONFIRMED",
            title: "Swap Confirmed! ✅",
            body: `Your swap for "${swap.dish.title}" has been confirmed. Ready for pickup!`,
            swapId: swap.id,
          },
        });

        return success({ message: "Swap confirmed" });
      }

      case "pickup": {
        // Either party can confirm pickup
        if (swap.buyerId !== user.id && swap.cookId !== user.id) return forbidden();
        if (swap.status !== "CONFIRMED") return badRequest("Swap must be confirmed first");

        await prisma.$transaction(async (tx: any) => {
          // Update swap
          await tx.swap.update({
            where: { id },
            data: { status: "PICKED_UP", pickedUpAt: new Date() },
          });

          // Update dish status
          await tx.dish.update({
            where: { id: swap.dishId },
            data: { status: "PICKED_UP" },
          });

          // Award credits to cook — balanceBefore/After are read fresh
          // inside the transaction (the old code used a stale snapshot).
          if (swap.creditAmount > 0) {
            const cook = await tx.user.findUnique({
              where: { id: swap.cookId },
              select: { credits: true },
            });
            const balanceBefore = cook?.credits ?? 0;
            await tx.user.update({
              where: { id: swap.cookId },
              data: { credits: { increment: swap.creditAmount } },
            });

            await tx.creditTransaction.create({
              data: {
                userId: swap.cookId,
                amount: swap.creditAmount,
                type: "EARNED",
                description: `Earned from swap: ${swap.dish.title}`,
                balanceBefore,
                balanceAfter: balanceBefore + swap.creditAmount,
              },
            });
          }

          // Update swap counts
          await tx.user.updateMany({
            where: { id: { in: [swap.buyerId, swap.cookId] } },
            data: { totalSwaps: { increment: 1 } },
          });
        });

        await prisma.notification.create({
          data: {
            userId: swap.cookId,
            type: "PICKUP_CONFIRMED",
            title: "Pickup Confirmed! 🎉",
            body: `"${swap.dish.title}" has been picked up. Credits transferred!`,
            swapId: swap.id,
          },
        });

        return success({ message: "Pickup confirmed" });
      }

      case "cancel": {
        if (swap.buyerId !== user.id && swap.cookId !== user.id && user.role !== "ADMIN") {
          return forbidden();
        }
        // PICKED_UP can no longer be cancelled: the cook has already been
        // paid, and the old code reset the dish to AVAILABLE while skipping
        // the refund — a state that loses the cook the dish and the credits.
        if (["COMPLETED", "CANCELLED", "PICKED_UP"].includes(swap.status)) {
          return badRequest("Cannot cancel a completed, picked-up or already cancelled swap");
        }

        const otherPartyId = user.id === swap.buyerId ? swap.cookId : swap.buyerId;

        await prisma.$transaction(async (tx: any) => {
          await tx.swap.update({
            where: { id },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason },
          });

          // Refund credits if deducted (balance read fresh in-transaction).
          if (swap.creditAmount > 0 && swap.status !== "PICKED_UP") {
            const buyer = await tx.user.findUnique({
              where: { id: swap.buyerId },
              select: { credits: true },
            });
            const balanceBefore = buyer?.credits ?? 0;
            await tx.user.update({
              where: { id: swap.buyerId },
              data: { credits: { increment: swap.creditAmount } },
            });

            await tx.creditTransaction.create({
              data: {
                userId: swap.buyerId,
                amount: swap.creditAmount,
                type: "REFUND",
                description: `Refund for cancelled swap: ${swap.dish.title}`,
                balanceBefore,
                balanceAfter: balanceBefore + swap.creditAmount,
              },
            });
          }

          // Make dish available again
          await tx.dish.update({
            where: { id: swap.dishId },
            data: { status: "AVAILABLE" },
          });
        });

        // Notify the other party about cancellation
        await prisma.notification.create({
          data: {
            userId: otherPartyId,
            type: "SWAP_CANCELLED",
            title: "Swap Cancelled ❌",
            body: `Swap for "${swap.dish.title}" has been cancelled${cancelReason ? `. Reason: ${cancelReason}` : ""}`,
            swapId: swap.id,
          },
        });

        return success({ message: "Swap cancelled and credits refunded" });
      }

      case "rate": {
        if (swap.buyerId !== user.id) return forbidden();
        if (swap.status !== "PICKED_UP") return badRequest("Can only rate after pickup");
        if (!score || score < 1 || score > 5) return badRequest("Score must be 1-5");
        if (typeof comment === "string" && comment.length > 1000) return badRequest("Comment must be at most 1000 characters");
        if (swap.rating) return badRequest("Already rated");

        await prisma.$transaction(async (tx: any) => {
          await tx.rating.create({
            data: {
              raterId: user.id,
              ratedId: swap.cookId,
              dishId: swap.dishId,
              swapId: swap.id,
              score,
              comment,
            },
          });

          await tx.swap.update({
            where: { id },
            data: { status: "COMPLETED" },
          });

          await tx.dish.update({
            where: { id: swap.dishId },
            data: { status: "COMPLETED" },
          });
        });

        // Notify the cook about the rating
        await prisma.notification.create({
          data: {
            userId: swap.cookId,
            type: "SWAP_RATED",
            title: `New Rating! ⭐ ${score}`,
            body: `${user.name} rated your "${swap.dish.title}" ${score}/5${comment ? `. "${comment}"` : ""}`,
            swapId: swap.id,
          },
        });

        return success({ message: "Rating submitted" });
      }

      default:
        return badRequest("Invalid action");
    }
  } catch (error) {
    console.error("Swap action error:", error);
    return serverError();
  }
}
