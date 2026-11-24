import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
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
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { type, amount } = await req.json();

    if (type === "PURCHASE") {
      // DISABLED: there is no Stripe integration in this app, so a credit
      // purchase can never be verified. The old code minted credits from a
      // client-supplied amount. Purchases stay disabled (503) until Stripe
      // PaymentIntents are integrated with server-side verification.
      return NextResponse.json(
        {
          message:
            "Credit purchase is not available yet. Payments are disabled until Stripe is integrated and verified server-side.",
        },
        { status: 503 }
      );
    }

    if (type === "DONATE") {
      const creditsToSpend =
        typeof amount === "number" ? amount : parseFloat(amount);
      if (!Number.isFinite(creditsToSpend) || creditsToSpend <= 0) {
        return badRequest("Invalid donation amount");
      }

      // Atomic donation: re-check the balance inside the transaction and
      // only decrement when the balance is still sufficient. The conditional
      // updateMany is the guard — if it touches 0 rows, a concurrent
      // request already spent the balance and the donation is rejected.
      const fresh = await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: user.id },
          select: { credits: true, badges: true },
        });
        if (!current || current.credits < creditsToSpend) return null;
        const updated = await tx.user.updateMany({
          where: { id: user.id, credits: { gte: creditsToSpend } },
          data: { credits: { decrement: creditsToSpend } },
        });
        if (updated.count !== 1) return null;
        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: -creditsToSpend,
            type: "DONATED",
            description: `Donated ${creditsToSpend} credits to platform`,
            balanceBefore: current.credits,
            balanceAfter: current.credits - creditsToSpend,
          },
        });
        return current;
      });

      if (!fresh) return badRequest("Insufficient credits");

      // Award donor badge if the pre-donation balance was 50+.
      if (fresh.credits >= 50 && !fresh.badges.includes("top_donor")) {
        await prisma.user.update({
          where: { id: user.id },
          data: { badges: { push: "top_donor" } },
        });
      }

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "CREDITS_DONATED",
          title: "Thank You! 💚",
          body: `You have donated ${creditsToSpend} credits to the platform. Your generosity helps keep CFE running!`,
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
