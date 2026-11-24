import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, notFound, success, serverError, badRequest, forbidden } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

const CATEGORIES = [
  "MAIN_COURSE", "APPETIZER", "DESSERT", "BREAKFAST", "SNACK",
  "BEVERAGE", "BAKED_GOODS", "SOUP", "SALAD", "OTHER",
];
const DISH_STATUSES = ["AVAILABLE", "RESERVED", "PICKED_UP", "COMPLETED", "CANCELLED", "EXPIRED"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        cook: {
          select: {
            id: true, name: true, avatar: true, isVerifiedCook: true,
            badges: true, totalSwaps: true, totalDishes: true, createdAt: true,
          },
        },
        swaps: {
          include: {
            buyer: { select: { id: true, name: true, avatar: true } },
          },
        },
        ratings: {
          include: {
            rater: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    if (!dish) return notFound("Dish not found");

    // Increment view count
    await prisma.dish.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return success(dish);
  } catch (error) {
    console.error("Get dish error:", error);
    return serverError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const { id } = await params;
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) return notFound("Dish not found");
    if (dish.cookId !== user.id && user.role !== "ADMIN") return forbidden();

    const body = await req.json();

    // Validate every supplied field — the old code wrote them unchecked.
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.length > 120)) {
      return badRequest("Title must be 3–120 characters");
    }
    if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
      return badRequest("Invalid category");
    }
    if (body.servings !== undefined) {
      const s = parseInt(body.servings);
      if (!Number.isInteger(s) || s < 1 || s > 100) return badRequest("Servings must be 1–100");
    }
    if (body.status !== undefined && !DISH_STATUSES.includes(body.status)) {
      return badRequest("Invalid status");
    }
    if (body.priceCredits !== undefined) {
      const p = parseFloat(body.priceCredits);
      if (!Number.isFinite(p) || p < 0) return badRequest("Invalid credit price");
    }
    if (body.image !== undefined && body.image !== null && body.image !== "" && !(typeof body.image === "string" && body.image.startsWith("https://res.cloudinary.com/"))) {
      return badRequest("Dish image must be a Cloudinary upload URL");
    }
    if (body.pickupFrom !== undefined && Number.isNaN(new Date(body.pickupFrom).getTime())) {
      return badRequest("Invalid pickupFrom");
    }
    if (body.pickupTo !== undefined && Number.isNaN(new Date(body.pickupTo).getTime())) {
      return badRequest("Invalid pickupTo");
    }
    if (body.ingredients !== undefined && (!Array.isArray(body.ingredients) || body.ingredients.length > 50)) {
      return badRequest("Invalid ingredients");
    }

    const updated = await prisma.dish.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category && { category: body.category }),
        ...(body.servings !== undefined && { servings: parseInt(body.servings) }),
        ...(body.status && { status: body.status }),
        ...(body.pickupFrom && { pickupFrom: new Date(body.pickupFrom) }),
        ...(body.pickupTo && { pickupTo: new Date(body.pickupTo) }),
        ...(body.priceCredits !== undefined && { priceCredits: parseFloat(body.priceCredits) }),
        ...(body.image !== undefined && { image: body.image }),
        ...(body.isSwappable !== undefined && { isSwappable: body.isSwappable }),
        ...(body.isFree !== undefined && { isFree: body.isFree }),
        ...(body.ingredients !== undefined && { ingredients: body.ingredients }),
        ...(body.latitude !== undefined && body.longitude !== undefined && {
          latitude: parseFloat(body.latitude),
          longitude: parseFloat(body.longitude),
        }),
      },
    });

    return success(updated);
  } catch (error) {
    console.error("Update dish error:", error);
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) return notFound("Dish not found");
    if (dish.cookId !== user.id && user.role !== "ADMIN") return forbidden();
    if (dish.status === "RESERVED") return badRequest("Cannot delete a reserved dish");

    await prisma.dish.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return success({ message: "Dish cancelled" });
  } catch (error) {
    console.error("Delete dish error:", error);
    return serverError();
  }
}
