import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";
import { getBoundingBox } from "@/lib/geo";
import { rateLimit } from "@/lib/ratelimit";

const CATEGORIES = [
  "MAIN_COURSE", "APPETIZER", "DESSERT", "BREAKFAST", "SNACK",
  "BEVERAGE", "BAKED_GOODS", "SOUP", "SALAD", "OTHER",
];

function isCloudinaryUrl(value: unknown): boolean {
  return (
    typeof value === "string" && value.startsWith("https://res.cloudinary.com/")
  );
}

export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "api-search");
    if (!rl.success) return rl.response!;

    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radius = Math.min(50, Math.max(1, parseFloat(searchParams.get("radius") || "5") || 5));
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;
    const isFree = searchParams.get("isFree") === "true";
    const isSwappable = searchParams.get("isSwappable") === "true";
    const minCredits = searchParams.get("minCredits");
    const maxCredits = searchParams.get("maxCredits");
    const sortBy = searchParams.get("sortBy") || "recent";
    const cookIdParam = searchParams.get("cookId");

    if ((searchParams.get("lat") || searchParams.get("lng")) && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
      return badRequest("Invalid coordinates");
    }
    if (category && category !== "ALL" && !CATEGORIES.includes(category)) {
      return badRequest("Invalid category");
    }
    if (!["recent", "credits_asc", "credits_desc"].includes(sortBy)) {
      return badRequest("Invalid sortBy");
    }

    let whereClause: Record<string, unknown> = {
      status: "AVAILABLE",
      pickupTo: { gte: new Date() },
    };

    // cookId filter (fixes profile "My dishes": ?cookId=me was ignored).
    // "me" resolves to the signed-in user; other ids are public cook pages.
    // A cook viewing their own dishes sees every status, not just AVAILABLE.
    if (cookIdParam) {
      const requester = await getAuthUser(req);
      const targetCookId = cookIdParam === "me" ? requester?.id : cookIdParam;
      if (!targetCookId) return unauthorized();
      whereClause.cookId = targetCookId;
      if (requester && requester.id === targetCookId) {
        delete whereClause.status;
        delete whereClause.pickupTo;
      }
    }

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
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const {
      title, description, ingredients, category, image,
      servings, quantity, unit, priceCredits, priceMoney,
      currency, pickupFrom, pickupTo, latitude, longitude,
      address, city, country, isSwappable, isFree, tags,
    } = body;

    // Server-side validation — the old code wrote most fields unchecked.
    if (!title || typeof title !== "string" || title.trim().length < 3 || title.length > 120) {
      return badRequest("Title must be 3–120 characters");
    }
    if (!category || !CATEGORIES.includes(category)) {
      return badRequest("Invalid category");
    }
    const servingsNum = parseInt(servings);
    if (!Number.isInteger(servingsNum) || servingsNum < 1 || servingsNum > 100) {
      return badRequest("Servings must be 1–100");
    }
    if (!pickupFrom || !pickupTo) return badRequest("Missing required fields");
    const from = new Date(pickupFrom);
    const to = new Date(pickupTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return badRequest("Invalid pickup window");
    }
    if (to <= new Date()) return badRequest("Pickup window must be in the future");
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return badRequest("A valid pickup location is required");
    }
    const credits = priceCredits === undefined || priceCredits === "" ? 0 : parseFloat(priceCredits);
    if (!Number.isFinite(credits) || credits < 0) return badRequest("Invalid credit price");
    const money = priceMoney === undefined || priceMoney === null || priceMoney === "" ? null : parseFloat(priceMoney);
    if (money !== null && (!Number.isFinite(money) || money < 0)) return badRequest("Invalid money price");
    if (image !== undefined && image !== null && image !== "" && !isCloudinaryUrl(image)) {
      return badRequest("Dish image must be a Cloudinary upload URL");
    }
    if (ingredients !== undefined && (!Array.isArray(ingredients) || ingredients.length > 50 || ingredients.some((i: unknown) => typeof i !== "string" || i.length > 100))) {
      return badRequest("Invalid ingredients");
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 20 || tags.some((t: unknown) => typeof t !== "string" || t.length > 50))) {
      return badRequest("Invalid tags");
    }
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) {
      return badRequest("Description must be at most 2000 characters");
    }

    const dish = await prisma.dish.create({
      data: {
        title: title.trim(),
        description,
        ingredients: ingredients || [],
        category,
        image: image || null,
        servings: servingsNum,
        quantity: quantity || servings.toString(),
        unit: unit || "servings",
        priceCredits: credits,
        priceMoney: money,
        currency,
        pickupFrom: from,
        pickupTo: to,
        latitude: lat,
        longitude: lng,
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
