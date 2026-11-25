import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

// MONEY is deliberately excluded: no payment processing is integrated, so
// a money swap can never be settled. It is rejected, not silently accepted.
const ALLOWED_SWAP_TYPES = ["CREDITS", "DIRECT", "FREE"] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    let whereClause: Record<string, unknown> = {};
    if (role === "buyer") whereClause.buyerId = user.id;
    else if (role === "cook") whereClause.cookId = user.id;
    else whereClause.OR = [{ buyerId: user.id }, { cookId: user.id }];

    if (status) whereClause.status = status;

    const [swaps, total] = await Promise.all([
      prisma.swap.findMany({
        where: whereClause,
        include: {
          dish: {
            select: {
              id: true, title: true, image: true, category: true,
              priceCredits: true, city: true,
            },
          },
          buyer: { select: { id: true, name: true, avatar: true } },
          cook: { select: { id: true, name: true, avatar: true } },
          rating: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.swap.count({ where: whereClause }),
    ]);

    return success({ swaps, pagination: { page, limit, total } });
  } catch (error) {
    console.error("Get swaps error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { dishId, type, message } = await req.json();

    if (!dishId || typeof dishId !== "string" || !type) {
      return badRequest("Dish ID and swap type are required");
    }
    if (!(ALLOWED_SWAP_TYPES as readonly string[]).includes(type)) {
      return badRequest(
        "Invalid swap type. MONEY swaps are not supported yet — no payment processing is integrated."
      );
    }
    if (message !== undefined && (typeof message !== "string" || message.length > 500)) {
      return badRequest("Message must be at most 500 characters");
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { cook: true },
    });

    if (!dish) return badRequest("Dish not found");
    if (dish.status !== "AVAILABLE") return badRequest("Dish is not available");
    if (dish.cookId === user.id) return badRequest("You cannot swap your own dish");

    // Check for existing pending swap
    const existingSwap = await prisma.swap.findFirst({
      where: { dishId, buyerId: user.id, status: "PENDING" },
    });
    if (existingSwap) return badRequest("You already have a pending swap for this dish");

    let creditAmount = 0;

    if (type === "DIRECT" && !dish.isSwappable) {
      return badRequest("This dish is not available for direct swap");
    }
    if (type === "FREE" && !dish.isFree) {
      return badRequest("This dish is not free");
    }
    if (type === "CREDITS") {
      if (dish.isFree) return badRequest("This dish is free — request it as a FREE swap");
      creditAmount = dish.priceCredits;
      if (!Number.isFinite(creditAmount) || creditAmount < 0) {
        return badRequest("Invalid dish price");
      }
    }

    // One transaction for the whole reservation: re-check the balance
    // inside the transaction, deduct atomically (conditional updateMany
    // guard — 0 rows means a concurrent request already spent the
    // balance), create the swap, and reserve the dish. Any failure rolls
    // everything back, so credits can never be deducted without a swap.
    let swap;
    try {
      swap = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (type === "CREDITS" && creditAmount > 0) {
          const fresh = await tx.user.findUnique({
            where: { id: user.id },
            select: { credits: true },
          });
          if (!fresh || fresh.credits < creditAmount) {
            throw new Error("INSUFFICIENT_CREDITS");
          }
          const updated = await tx.user.updateMany({
            where: { id: user.id, credits: { gte: creditAmount } },
            data: { credits: { decrement: creditAmount } },
          });
          if (updated.count !== 1) throw new Error("INSUFFICIENT_CREDITS");
          await tx.creditTransaction.create({
            data: {
              userId: user.id,
              amount: -creditAmount,
              type: "SPENT",
              description: `Reserved swap for: ${dish.title}`,
              balanceBefore: fresh.credits,
              balanceAfter: fresh.credits - creditAmount,
            },
          });
        }

        // Reserve the dish only if it is still AVAILABLE.
        const reserved = await tx.dish.updateMany({
          where: { id: dishId, status: "AVAILABLE" },
          data: { status: "RESERVED" },
        });
        if (reserved.count !== 1) throw new Error("DISH_NOT_AVAILABLE");

        return tx.swap.create({
          data: {
            dishId,
            buyerId: user.id,
            cookId: dish.cookId,
            type,
            status: "PENDING",
            creditAmount,
            message,
          },
          include: {
            dish: { select: { id: true, title: true, image: true } },
            buyer: { select: { id: true, name: true, avatar: true } },
            cook: { select: { id: true, name: true, avatar: true } },
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
        return badRequest(
          `Insufficient credits. You need ${creditAmount} credits but have ${user.credits}.`
        );
      }
      if (error instanceof Error && error.message === "DISH_NOT_AVAILABLE") {
        return badRequest("Dish is not available");
      }
      throw error;
    }

    // Notify the cook
    await prisma.notification.create({
      data: {
        userId: dish.cookId,
        type: "SWAP_REQUEST",
        title: "New Swap Request! 🍽️",
        body: `${user.name} wants to swap for your "${dish.title}"`,
        swapId: swap.id,
        data: { swapId: swap.id, dishId },
      },
    });

    return success(swap, 201);
  } catch (error) {
    console.error("Create swap error:", error);
    return serverError();
  }
}
