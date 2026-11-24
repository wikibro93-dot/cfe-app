import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, success, serverError, badRequest, notFound, forbidden } from "@/lib/middleware";

/**
 * PATCH /api/users/notifications/[id] — mark one notification as read.
 *
 * This route exists because the notifications page calls
 * `PATCH /api/users/notifications/${id}`, while the collection route only
 * accepted `?id=...` — so single mark-as-read always 404d. Both shapes
 * are now supported.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id: notificationId } = await params;
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
