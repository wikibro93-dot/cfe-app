import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden, success, serverError, badRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!["ADMIN", "MODERATOR"].includes(user.role)) return forbidden();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const page = parseInt(searchParams.get("page") || "1");
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
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorized();
    if (authUser.role !== "ADMIN") return forbidden();

    const { userId, action, value } = await req.json();
    if (!userId || !action) return badRequest("userId and action required");

    switch (action) {
      case "setRole":
        await prisma.user.update({ where: { id: userId }, data: { role: value } });
        break;
      case "verifyCook":
        await prisma.user.update({ where: { id: userId }, data: { isVerifiedCook: true } });
        break;
      case "addCredits":
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: parseFloat(value) } },
        });
        break;
      default:
        return badRequest("Invalid action");
    }

    return success({ message: "User updated" });
  } catch (error) {
    return serverError();
  }
}
