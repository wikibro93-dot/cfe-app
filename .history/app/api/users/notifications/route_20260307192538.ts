import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = notifications.filter((n: any) => !n.read).length;

    return success({ notifications, unreadCount });
  } catch (error) {
    return serverError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });

    return success({ message: "All notifications marked as read" });
  } catch (error) {
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) return badRequest("Notification ID is required");

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) return notFound("Notification not found");
    if (notification.userId !== user.id) return forbidden();

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return success({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return serverError();
  }
}
