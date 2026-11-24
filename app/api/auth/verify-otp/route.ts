import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
// import { verifyOTP, signToken } from "@/lib/auth";
import { signToken } from "@/lib/auth";
import { badRequest, success, serverError } from "@/lib/middleware";

export async function POST(req: NextRequest) {
  try {
    const { phone, code, name, language, currency } = await req.json();

    if (!phone || !code) {
      return badRequest("Phone and OTP code are required");
    }

    // OTP verification commented out - will be uncommented later
    // const isValid = await verifyOTP(phone, code);
    // if (!isValid) {
    //   return badRequest("Invalid or expired OTP");
    // }

    // For development: accept any 6-digit code
    if (!/^\d{6}$/.test(code)) {
      return badRequest("Invalid OTP format. Use 6 digits.");
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
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return serverError();
  }
}
