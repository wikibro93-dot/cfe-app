import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { signToken } from "@/lib/auth";
import {
  verifyFirebaseIdToken,
  isFirebaseAdminConfigured,
} from "@/lib/firebase-admin";
import { badRequest, success, serverError, setAuthCookie } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

const LANGUAGES = ["en", "ur", "de", "es"];

/**
 * Sign in with Google or Facebook via Firebase Auth.
 *
 * The browser signs in with Firebase and sends the Firebase ID token.
 * This route verifies that token with the Admin SDK (a token the client
 * merely claims is never trusted), finds or creates the CFE user, and
 * issues the app's own httpOnly session cookie — the same session the
 * rest of the app already uses. No password, no SMS code, no per-login
 * cost: social sign-in is free on Firebase's Spark plan.
 *
 * Account linking: a user is found by Firebase UID first; if that misses,
 * by their (provider-verified) email, so one person using Google and
 * Facebook ends up on a single account. The provider's name/photo are
 * only used when the account is created or linked — a name the user
 * later changes in their profile is never overwritten on sign-in.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "auth-social");
    if (!rl.success) return rl.response!;

    if (!isFirebaseAdminConfigured()) {
      return serverError("Social sign-in is not configured yet");
    }

    const { idToken, language, currency } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return badRequest("Sign-in token is required");
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded) {
      return badRequest("Invalid or expired sign-in token");
    }

    const signInProvider = decoded.firebase?.sign_in_provider;
    if (signInProvider !== "google.com" && signInProvider !== "facebook.com") {
      return badRequest("Unsupported sign-in provider");
    }
    const authProvider = signInProvider === "google.com" ? "GOOGLE" : "FACEBOOK";

    const email =
      typeof decoded.email === "string" ? decoded.email.toLowerCase() : null;
    const name = typeof decoded.name === "string" ? decoded.name.trim() : "";
    const picture = typeof decoded.picture === "string" ? decoded.picture : null;

    const lang = LANGUAGES.includes(language) ? language : "en";
    const curr =
      typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "USD";

    let user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });
    let isNewUser = false;

    if (!user && email) {
      // Link by verified email: the same person on the other provider.
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            firebaseUid: decoded.uid,
            authProvider,
            isVerified: true,
            ...(byEmail.name ? {} : name ? { name } : {}),
            ...(byEmail.avatar ? {} : picture ? { avatar: picture } : {}),
          },
        });
      }
    }

    if (!user) {
      if (!email) {
        return badRequest("Your sign-in account has no email address");
      }
      if (!name || name.length > 100) {
        return badRequest("A name is required to create your account");
      }

      // Create the user and the welcome-bonus ledger entry atomically.
      user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.user.create({
          data: {
            email,
            firebaseUid: decoded.uid,
            authProvider,
            name,
            avatar: picture,
            isVerified: true,
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
      isNewUser = true;
    } else if (language || currency) {
      // Returning user: only refresh preferences if provided.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(language && { language: lang }),
          ...(currency && { currency: curr }),
        },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    const token = signToken({
      userId: user.id,
      phone: user.phone ?? undefined,
      role: user.role,
    });

    // The token is set as an httpOnly cookie. It is deliberately NOT
    // returned in the JSON body, so page JavaScript can never read it.
    const res = success({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
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
      isNewUser,
    });
    return setAuthCookie(res, token);
  } catch (error) {
    console.error("Social sign-in error:", error);
    return serverError();
  }
}
