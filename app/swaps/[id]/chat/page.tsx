"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function SwapChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAppStore();

  const { data: swap, isLoading } = useQuery({
    queryKey: ["swap", id],
    queryFn: async () => {
      const res = await fetch(`/api/swaps/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!token && !!id,
  });

  const otherUser = swap
    ? swap.buyerId === user?.id
      ? swap.cook
      : swap.buyer
    : null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="glass border-b border-white/60 dark:border-stone-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} className="text-stone-600 dark:text-stone-300" />
          </button>
          <div>
            <p className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              {isLoading ? "Loading..." : `Chat with ${otherUser?.name ?? "..."}`}
            </p>
            {swap && (
              <p className="text-xs text-stone-400">
                Swap: {swap.dish?.title}
              </p>
            )}
          </div>
        </div>

        {/* Chat area fills remaining height */}
        {!isLoading && otherUser && (
          <div className="flex-1 flex flex-col min-h-0" style={{ height: "calc(100vh - 64px)" }}>
            <ChatPanel
              swapId={id}
              otherUser={otherUser}
              embedded
            />
          </div>
        )}

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-float text-4xl">💬</div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
