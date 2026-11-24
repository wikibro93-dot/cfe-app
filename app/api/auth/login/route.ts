import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { badRequest, success, serverError } from "@/lib/middleware";

export async function POST(req: NextRequest) {
  try {
    const { phone, name, language, currency } = await req.json();

    if (!phone) {
      return badRequest("Phone number is required");
    }

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      if (!name?.trim()) {
        return badRequest("Name is required for new users");
      }

      user = await prisma.user.create({
        data: {
          phone,
          name: name.trim(),
          language: language || "en",
          currency: currency || "USD",
          credits: 10, // Welcome bonus
        },
      });

      // Welcome bonus credit transaction
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 10,
          type: "BONUS",
          description: "Welcome bonus!",
          balanceBefore: 0,
          balanceAfter: 10,
        },
      });
    } else {
      // Update language/currency preferences if provided
      if (language || currency) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(language && { language }),
            ...(currency && { currency }),
          },
        });
      }
    }

    // Get unread notification count
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    const token = signToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    return success({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        credits: user.credits,
        avatar: user.avatar,
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        country: user.country,
        currency: user.currency,
        language: user.language,
        isVerifiedCook: user.isVerifiedCook,
        badges: user.badges,
        totalSwaps: user.totalSwaps,
        totalDishes: user.totalDishes,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Login error:", error);
    return serverError();
  }
}
