import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden, success, serverError } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!["ADMIN", "MODERATOR"].includes(user.role)) return forbidden();

    const [
      totalUsers,
      totalDishes,
      totalSwaps,
      activeDishes,
      completedSwaps,
      recentUsers,
      recentDishes,
      topCooks,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.dish.count(),
      prisma.swap.count(),
      prisma.dish.count({ where: { status: "AVAILABLE" } }),
      prisma.swap.count({ where: { status: "COMPLETED" } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, name: true, phone: true, role: true,
          credits: true, createdAt: true, totalSwaps: true,
        },
      }),
      prisma.dish.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          cook: { select: { name: true } },
          _count: { select: { swaps: true } },
        },
      }),
      prisma.user.findMany({
        orderBy: { totalSwaps: "desc" },
        take: 5,
        select: {
          id: true, name: true, avatar: true, totalSwaps: true,
          totalDishes: true, badges: true, isVerifiedCook: true,
        },
      }),
    ]);

    // Credit stats
    const creditStats = await prisma.creditTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      _count: true,
    });

    return success({
      stats: {
        totalUsers,
        totalDishes,
        totalSwaps,
        activeDishes,
        completedSwaps,
        successRate: totalSwaps > 0 ? Math.round((completedSwaps / totalSwaps) * 100) : 0,
      },
      creditStats,
      recentUsers,
      recentDishes,
      topCooks,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return serverError();
  }
}
