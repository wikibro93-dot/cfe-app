import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, notFound, success, serverError, badRequest, forbidden } from "@/lib/middleware";

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
    const { id } = await params;
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) return notFound("Dish not found");
    if (dish.cookId !== user.id && user.role !== "ADMIN") return forbidden();

    const body = await req.json();
    const updated = await prisma.dish.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
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
