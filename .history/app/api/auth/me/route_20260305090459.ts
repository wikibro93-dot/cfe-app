import { NextRequest } from "next/server";
import { getAuthUser, unauthorized, success, serverError } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

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

    const { prisma } = await import("@/lib/db");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
        ...(bio !== undefined && { bio }),
        ...(avatar && { avatar }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
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
