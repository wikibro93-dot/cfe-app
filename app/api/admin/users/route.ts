import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuthUser, unauthorized, forbidden, success, serverError, badRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

const ROLES = ["COOK", "BUYER", "MODERATOR", "ADMIN"] as const;

export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "api-general");
    if (!rl.success) return rl.response!;

    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!["ADMIN", "MODERATOR"].includes(user.role)) return forbidden();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true, name: true, phone: true, role: true,
          credits: true, isVerifiedCook: true, badges: true,
          totalSwaps: true, totalDishes: true, createdAt: true,
          city: true, country: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return success({ users, pagination: { page, limit, total } });
  } catch (error) {
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "api-write");
    if (!rl.success) return rl.response!;

    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorized();
    if (authUser.role !== "ADMIN") return forbidden();

    const { userId, action, value } = await req.json();
    if (!userId || !action) return badRequest("userId and action required");

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, credits: true },
    });
    if (!target) return badRequest("User not found");

    switch (action) {
      case "setRole": {
        if (!(ROLES as readonly string[]).includes(value)) {
          return badRequest("Invalid role");
        }
        // An admin cannot demote themselves out of ADMIN.
        if (userId === authUser.id && value !== "ADMIN") {
          return badRequest("You cannot change your own admin role");
        }
        // Never remove the last admin.
        if (value !== "ADMIN" && target.role === "ADMIN") {
          const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
          if (adminCount <= 1) {
            return badRequest("Cannot remove the last admin");
          }
        }
        await prisma.user.update({ where: { id: userId }, data: { role: value } });
        break;
      }
      case "verifyCook":
        await prisma.user.update({ where: { id: userId }, data: { isVerifiedCook: true } });
        break;
      case "addCredits": {
        const delta = parseFloat(value);
        if (!Number.isFinite(delta)) return badRequest("Invalid credit amount");
        // Admin grants are ledgered (the old code changed the balance with
        // no record) and applied atomically with the ledger entry.
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.user.update({
            where: { id: userId },
            data: { credits: { increment: delta } },
          });
          await tx.creditTransaction.create({
            data: {
              userId,
              amount: delta,
              type: "BONUS",
              description: "Admin credit adjustment",
              balanceBefore: target.credits,
              balanceAfter: target.credits + delta,
            },
          });
        });
        break;
      }
      default:
        return badRequest("Invalid action");
    }

    return success({ message: "User updated" });
  } catch (error) {
    return serverError();
  }
}
