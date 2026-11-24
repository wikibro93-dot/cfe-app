import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";
import { getBoundingBox } from "@/lib/geo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radius = parseFloat(searchParams.get("radius") || "5");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const isFree = searchParams.get("isFree") === "true";
    const isSwappable = searchParams.get("isSwappable") === "true";
    const minCredits = searchParams.get("minCredits");
    const maxCredits = searchParams.get("maxCredits");
    const sortBy = searchParams.get("sortBy") || "recent";

    let whereClause: Record<string, unknown> = {
      status: "AVAILABLE",
      pickupTo: { gte: new Date() },
    };

    // Geo filter
    if (lat && lng) {
      const box = getBoundingBox(lat, lng, radius);
      whereClause = {
        ...whereClause,
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLon, lte: box.maxLon },
      };
    }

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    if (isFree) whereClause.isFree = true;
    if (isSwappable) whereClause.isSwappable = true;
    if (minCredits) whereClause.priceCredits = { ...(typeof whereClause.priceCredits === "object" ? whereClause.priceCredits as object : {}), gte: parseFloat(minCredits) };
    if (maxCredits) whereClause.priceCredits = { ...(typeof whereClause.priceCredits === "object" ? whereClause.priceCredits as object : {}), lte: parseFloat(maxCredits) };

    const [dishes, total] = await Promise.all([
      prisma.dish.findMany({
        where: whereClause,
        include: {
          cook: {
            select: {
              id: true,
              name: true,
              avatar: true,
              isVerifiedCook: true,
              badges: true,
              totalSwaps: true,
            },
          },
          _count: { select: { swaps: true } },
        },
        orderBy: sortBy === "credits_asc" ? { priceCredits: "asc" } : sortBy === "credits_desc" ? { priceCredits: "desc" } : { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dish.count({ where: whereClause }),
    ]);

    return success({
      dishes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get dishes error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const {
      title, description, ingredients, category, image,
      servings, quantity, unit, priceCredits, priceMoney,
      currency, pickupFrom, pickupTo, latitude, longitude,
      address, city, country, isSwappable, isFree, tags,
    } = body;

    if (!title || !category || !servings || !pickupFrom || !pickupTo || !latitude || !longitude) {
      return badRequest("Missing required fields");
    }

    const dish = await prisma.dish.create({
      data: {
        title,
        description,
        ingredients: ingredients || [],
        category,
        image,
        servings: parseInt(servings),
        quantity: quantity || servings.toString(),
        unit: unit || "servings",
        priceCredits: parseFloat(priceCredits) || 0,
        priceMoney: priceMoney ? parseFloat(priceMoney) : null,
        currency,
        pickupFrom: new Date(pickupFrom),
        pickupTo: new Date(pickupTo),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        city: city || user.city || "Unknown",
        country: country || user.country || "Unknown",
        isSwappable: isSwappable !== false,
        isFree: isFree === true,
        tags: tags || [],
        cookId: user.id,
      },
      include: {
        cook: {
          select: { id: true, name: true, avatar: true, isVerifiedCook: true },
        },
      },
    });

    // Update user dish count
    await prisma.user.update({
      where: { id: user.id },
      data: { totalDishes: { increment: 1 } },
    });

    return success(dish, 201);
  } catch (error) {
    console.error("Create dish error:", error);
    return serverError();
  }
}
