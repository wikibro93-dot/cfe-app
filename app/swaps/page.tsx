"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";


const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PICKED_UP: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-stone-100 text-stone-500",
  DISPUTED: "bg-red-100 text-red-600",
};

const TYPE_EMOJI: Record<string, string> = {
  CREDITS: "💰", DIRECT: "🔄", FREE: "💚", MONEY: "💵",
};

export default function SwapsPage() {
  const { token, user, updateCredits } = useAppStore();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<"all" | "buyer" | "cook">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["swaps", role],
    queryFn: async () => {
      const res = await fetch(`/api/swaps?role=${role}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!token,
  });

  const doAction = async (swapId: string, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(swapId + action);
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["swaps"] });
      
      // Update credits after actions that affect credits
      if (action === "pickup" || action === "cancel") {
        // Fetch updated user data to get new credit balance
        const userRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = await userRes.json();
        if (userData?.user?.credits !== undefined) {
          updateCredits(userData.user.credits);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const swaps = data?.swaps || [];

  return (
    <div>
      <Header title="My Swaps" />

      <div className="px-4 pt-4 space-y-4">
        {/* Role filter */}
        <div className="flex gap-2 bg-stone-100 rounded-2xl p-1">
          {[
            { value: "all", label: "All" },
            { value: "buyer", label: "I Requested" },
            { value: "cook", label: "My Dishes" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRole(value as any)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                role === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-shimmer rounded-2xl" />
            ))}
          </div>
        ) : swaps.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 animate-float">🔄</div>
            <h3 className="font-bold text-stone-700 mb-1">No swaps yet</h3>
            <p className="text-sm text-stone-400">Browse dishes and request your first swap!</p>
            <Link href="/feed">
              <Button className="mt-4">Browse Dishes</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {swaps.map((swap: any) => {
              const isBuyer = swap.buyerId === user?.id;
              const otherPerson = isBuyer ? swap.cook : swap.buyer;

              return (
                <div key={swap.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Dish image/emoji */}
                      <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center text-2xl shrink-0">
                        {swap.dish?.image ? (
                          <img src={swap.dish.image} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : "🍽️"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-stone-900 text-sm leading-tight">{swap.dish?.title}</p>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[swap.status]}`}>
                            {swap.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {isBuyer ? "📤 Requested from" : "📥 Request from"} <strong>{otherPerson?.name}</strong>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-stone-500">
                            {TYPE_EMOJI[swap.type]} {swap.type}
                          </span>
                          {swap.creditAmount > 0 && (
                            <span className="text-xs text-green-600 font-semibold">{swap.creditAmount} credits</span>
                          )}
                          <span className="text-xs text-stone-300">·</span>
                          <span className="text-xs text-stone-400">{format(new Date(swap.createdAt), "MMM d")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="border-t border-stone-50 px-4 py-3 flex gap-2">
                    {/* Cook: confirm pending swap */}
                    {!isBuyer && swap.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          loading={actionLoading === swap.id + "confirm"}
                          onClick={() => doAction(swap.id, "confirm")}
                        >
                          ✅ Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={actionLoading === swap.id + "cancel"}
                          onClick={() => doAction(swap.id, "cancel", { cancelReason: "Cook declined" })}
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {/* Buyer: Navigate to dish */}
                    {isBuyer && swap.status === "CONFIRMED" && (
                      <Link href={`/swaps/${swap.id}/navigate`} className="flex-1">
                        <Button size="sm" variant="primary" fullWidth>
                          🧭 Navigate
                        </Button>
                      </Link>
                    )}

                    {/* Cook: Track buyer */}
                    {!isBuyer && swap.status === "CONFIRMED" && (
                      <Link href={`/swaps/${swap.id}/track`} className="flex-1">
                        <Button size="sm" variant="primary" fullWidth>
                          📍 Track Buyer
                        </Button>
                      </Link>
                    )}

                    {/* Confirm pickup */}
                    {isBuyer && swap.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        loading={actionLoading === swap.id + "pickup"}
                        onClick={() => doAction(swap.id, "pickup")}
                      >
                        🎉 Confirm Pickup
                      </Button>
                    )}

                    {/* Cancel (buyer, pending) */}
                    {isBuyer && swap.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={actionLoading === swap.id + "cancel"}
                        onClick={() => doAction(swap.id, "cancel", { cancelReason: "Buyer cancelled" })}
                      >
                        Cancel Request
                      </Button>
                    )}

                    {/* Rate */}
                    {isBuyer && swap.status === "PICKED_UP" && !swap.rating && (
                      <Link href={`/swaps/${swap.id}/rate`} className="flex-1">
                        <Button size="sm" variant="outline" fullWidth>⭐ Leave Rating</Button>
                      </Link>
                    )}

                    {/* Chat */}
                    {["PENDING","CONFIRMED","PICKED_UP"].includes(swap.status) && (
                      <Link href={`/swaps/${swap.id}/chat`} className="flex-1">
                        <Button size="sm" variant="ghost" fullWidth>💬 Chat</Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
