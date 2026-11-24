import { NextRequest } from "next/server";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";
import { prisma } from "@/lib/db";

const LANGUAGES = ["en", "ur", "de", "es"];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    // Get unread notification count
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    return success({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      credits: user.credits,
      avatar: user.avatar,
      bio: user.bio,
      latitude: user.latitude,
      longitude: user.longitude,
      city: user.city,
      country: user.country,
      currency: user.currency,
      language: user.language,
      isVerified: user.isVerified,
      isVerifiedCook: user.isVerifiedCook,
      badges: user.badges,
      totalSwaps: user.totalSwaps,
      totalDishes: user.totalDishes,
      createdAt: user.createdAt,
      unreadCount,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return serverError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { name, bio, avatar, latitude, longitude, city, country, language, currency } =
      await req.json();

    if (name !== undefined && (typeof name !== "string" || name.trim().length < 1 || name.length > 100)) {
      return badRequest("Name must be 1–100 characters");
    }
    if (bio !== undefined && bio !== null && (typeof bio !== "string" || bio.length > 500)) {
      return badRequest("Bio must be at most 500 characters");
    }
    if (avatar !== undefined && avatar !== null && avatar !== "" && !(typeof avatar === "string" && avatar.startsWith("https://res.cloudinary.com/"))) {
      return badRequest("Avatar must be a Cloudinary upload URL");
    }
    if (latitude !== undefined && latitude !== null && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
      return badRequest("Invalid latitude");
    }
    if (longitude !== undefined && longitude !== null && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
      return badRequest("Invalid longitude");
    }
    if (city !== undefined && city !== null && (typeof city !== "string" || city.length > 100)) {
      return badRequest("City must be at most 100 characters");
    }
    if (country !== undefined && country !== null && (typeof country !== "string" || country.length > 100)) {
      return badRequest("Country must be at most 100 characters");
    }
    if (language !== undefined && language !== null && !LANGUAGES.includes(language)) {
      return badRequest("Invalid language");
    }
    if (currency !== undefined && currency !== null && !/^[A-Z]{3}$/.test(currency)) {
      return badRequest("Invalid currency");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(bio !== undefined && { bio }),
        ...(avatar && { avatar }),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...(city && { city }),
        ...(country && { country }),
        ...(language && { language }),
        ...(currency && { currency }),
      },
    });

    return success({ message: "Profile updated", user: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    return serverError();
  }
}
