import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.creditTransaction.count({ where: { userId: user.id } }),
    ]);

    return success({
      balance: user.credits,
      transactions,
      pagination: { page, limit, total },
    });
  } catch (error) {
    console.error("Get credits error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { type, amount, paymentIntentId } = await req.json();

    if (!type || !amount || amount <= 0) return badRequest("Invalid request");

    if (type === "PURCHASE") {
      // In production, verify paymentIntentId with Stripe here
      // For now, accept mock payments in development
      if (process.env.NODE_ENV === "production" && !paymentIntentId) {
        return badRequest("Payment verification required");
      }

      const creditsToAdd = parseFloat(amount);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: creditsToAdd } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: creditsToAdd,
            type: "PURCHASED",
            description: `Purchased ${creditsToAdd} credits`,
            balanceBefore: user.credits,
            balanceAfter: user.credits + creditsToAdd,
          },
        }),
      ]);

      const updated = await prisma.user.findUnique({ where: { id: user.id } });

      // Notify user about credit purchase
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "CREDITS_PURCHASED",
          title: "Credits Added! 💰",
          body: `You've successfully purchased ${creditsToAdd} credits. Your new balance is ${updated?.credits} credits.`,
        },
      });

      return success({
        message: `Successfully purchased ${creditsToAdd} credits`,
        newBalance: updated?.credits,
      });
    }

    if (type === "DONATE") {
      const creditsToSpend = parseFloat(amount);
      if (user.credits < creditsToSpend) return badRequest("Insufficient credits");

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { credits: { decrement: creditsToSpend } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: -creditsToSpend,
            type: "DONATED",
            description: `Donated ${creditsToSpend} credits to platform`,
            balanceBefore: user.credits,
            balanceAfter: user.credits - creditsToSpend,
          },
        }),
      ]);

      // Award donor badge if donated enough
      if (user.credits >= 50) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            badges: {
              push: "top_donor",
            },
          },
        });
      }

      // Notify user about donation
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "CREDITS_DONATED",
          title: "Thank You! 💚",
          body: `You've donated ${creditsToSpend} credits to the platform. Your generosity helps keep CFE running!`,
        },
      });

      return success({ message: "Thank you for your donation! 💚" });
    }

    return badRequest("Invalid credit type");
  } catch (error) {
    console.error("Credits error:", error);
    return serverError();
  }
}
