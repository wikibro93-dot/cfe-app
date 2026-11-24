"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

export default function NotificationsPage() {
  const { token, setNotificationCount } = useAppStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/users/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!token,
  });

  const markAllRead = async () => {
    await fetch("/api/users/notifications", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotificationCount(0);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("All marked as read");
  };

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;

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
              className={`rounded-2xl p-4 border ${
                !notif.read ? "bg-green-50 border-green-100" : "bg-white border-stone-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">
                  {notif.type === "SWAP_REQUEST" ? "🔄" :
                   notif.type === "SWAP_CONFIRMED" ? "✅" :
                   notif.type === "PICKUP_CONFIRMED" ? "🎉" : "🔔"}
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
