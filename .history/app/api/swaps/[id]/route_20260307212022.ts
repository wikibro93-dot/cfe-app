import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, notFound, success, serverError, badRequest, forbidden } from "@/lib/middleware";

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

          // Award credits to cook
          if (swap.creditAmount > 0) {
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
                balanceBefore: swap.cook.credits,
                balanceAfter: swap.cook.credits + swap.creditAmount,
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
        if (["COMPLETED", "CANCELLED"].includes(swap.status)) {
          return badRequest("Cannot cancel a completed or already cancelled swap");
        }

        await prisma.$transaction(async (tx: any) => {
          await tx.swap.update({
            where: { id },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason },
          });

          // Refund credits if deducted
          if (swap.creditAmount > 0 && swap.status !== "PICKED_UP") {
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
                balanceBefore: swap.buyer.credits,
                balanceAfter: swap.buyer.credits + swap.creditAmount,
              },
            });
          }

          // Make dish available again
          await tx.dish.update({
            where: { id: swap.dishId },
            data: { status: "AVAILABLE" },
          });
        });

        return success({ message: "Swap cancelled and credits refunded" });
      }

      case "rate": {
        if (swap.buyerId !== user.id) return forbidden();
        if (swap.status !== "PICKED_UP") return badRequest("Can only rate after pickup");
        if (!score || score < 1 || score > 5) return badRequest("Score must be 1-5");
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
