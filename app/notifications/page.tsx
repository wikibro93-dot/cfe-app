"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NotificationsPage() {
  const { user, setNotificationCount, notificationCount } = useAppStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch("/api/users/notifications", { credentials: "same-origin" });
      return res.json();
    },
    enabled: !!user,
  });

  // Update notification count in store when data is fetched
  useEffect(() => {
    if (data?.unreadCount !== undefined) {
      setNotificationCount(data.unreadCount);
    }
  }, [data, setNotificationCount]);

  const markAllRead = async () => {
    await fetch("/api/users/notifications", {
      method: "PUT",
      credentials: "same-origin",
    });
    setNotificationCount(0);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("All marked as read");
  };

  const handleNotificationClick = async (notif: any) => {
    // Mark as read — PATCH /api/users/notifications/[id] now exists
    // (the old code called this path and always got a 404).
    if (!notif.read) {
      await fetch(`/api/users/notifications/${notif.id}`, {
        method: "PATCH",
        credentials: "same-origin",
      });
      setNotificationCount(Math.max(0, notificationCount - 1));
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }

    // Navigate based on notification type
    switch (notif.type) {
      case "SWAP_REQUEST":
      case "SWAP_CONFIRMED":
      case "SWAP_CANCELLED":
      case "SWAP_RATED":
      case "PICKUP_CONFIRMED":
        if (notif.swapId) {
          router.push(`/swaps/${notif.swapId}`);
        }
        break;
      case "CREDITS_PURCHASED":
      case "CREDITS_DONATED":
        router.push("/credits");
        break;
      default:
        break;
    }
  };

  const notifications = (data as any)?.notifications || [];
  const unread = (data as any)?.unreadCount || 0;

  return (
    <div>
      <Header title="Notifications" rightAction={
        unread > 0 ? (
          <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
        ) : undefined
      } />

      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-shimmer rounded-2xl" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="font-bold text-stone-700 mb-1">All caught up!</h3>
            <p className="text-sm text-stone-400">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif: any) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`rounded-2xl p-4 border cursor-pointer transition-all hover:shadow-md ${
                !notif.read ? "bg-green-50 border-green-100" : "bg-white border-stone-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">
                  {notif.type === "SWAP_REQUEST" ? "🔄" :
                   notif.type === "SWAP_CONFIRMED" ? "✅" :
                   notif.type === "SWAP_CANCELLED" ? "❌" :
                   notif.type === "SWAP_RATED" ? "⭐" :
                   notif.type === "PICKUP_CONFIRMED" ? "🎉" :
                   notif.type === "CREDITS_PURCHASED" ? "💰" :
                   notif.type === "CREDITS_DONATED" ? "💚" : "🔔"}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-stone-800 text-sm">{notif.title}</p>
                  <p className="text-sm text-stone-600 mt-0.5">{notif.body}</p>
                  <p className="text-xs text-stone-400 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
