import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
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
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { dishId, type, message } = await req.json();

    if (!dishId || !type) return badRequest("Dish ID and swap type are required");

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

    if (type === "CREDITS") {
      creditAmount = dish.priceCredits;
      if (user.credits < creditAmount) {
        return badRequest(`Insufficient credits. You need ${creditAmount} credits but have ${user.credits}.`);
      }

      // Deduct credits immediately (holds them)
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { decrement: creditAmount } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: -creditAmount,
            type: "SPENT",
            description: `Reserved swap for: ${dish.title}`,
            balanceBefore: user.credits,
            balanceAfter: user.credits - creditAmount,
          },
        }),
      ]);
    }

    // Create swap
    const swap = await prisma.swap.create({
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

    // Update dish status
    await prisma.dish.update({
      where: { id: dishId },
      data: { status: "RESERVED" },
    });

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
