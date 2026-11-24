import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOTP, signToken } from "@/lib/auth";
import { badRequest, success, serverError, setAuthCookie } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

const LANGUAGES = ["en", "ur", "de", "es"];

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "verify-otp");
    if (!rl.success) return rl.response!;

    const { phone, code, name, language, currency } = await req.json();

    if (!phone || !code) {
      return badRequest("Phone and OTP code are required");
    }

    if (!/^\d{6}$/.test(code)) {
      return badRequest("Invalid OTP format. Use 6 digits.");
    }

    // Real OTP verification: hashed code, 10-minute expiry, single-use,
    // invalidated after 5 wrong attempts.
    const isValid = await verifyOTP(phone, code);
    if (!isValid) {
      return badRequest("Invalid or expired OTP");
    }

    const lang = LANGUAGES.includes(language) ? language : "en";
    const curr =
      typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "USD";

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      if (!name?.trim() || name.trim().length > 100) {
        return badRequest("Name is required for new users (max 100 characters)");
      }

      // Create the user and the welcome-bonus ledger entry atomically.
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            phone,
            name: name.trim(),
            language: lang,
            currency: curr,
            credits: 10, // Welcome bonus
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: created.id,
            amount: 10,
            type: "BONUS",
            description: "Welcome bonus!",
            balanceBefore: 0,
            balanceAfter: 10,
          },
        });

        return created;
      });
    } else {
      // Update language/currency preferences if provided
      if (language || currency) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(language && { language: lang }),
            ...(currency && { currency: curr }),
          },
        });
      }
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    const token = signToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    // The token is set as an httpOnly cookie. It is deliberately NOT
    // returned in the JSON body, so page JavaScript can never read it.
    const res = success({
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
    return setAuthCookie(res, token);
  } catch (error) {
    console.error("Verify OTP error:", error);
    return serverError();
  }
}
