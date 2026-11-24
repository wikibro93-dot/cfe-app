"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ChatBubble } from "@/components/chat/ChatPanel";
import {
  MapPin,
  Calendar,
  Clock,
  User,
  Star,
  MessageSquare,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import toast from "react-hot-toast";

export default function SwapDetailsPage() {
  const params = useParams();
  const { user } = useAppStore();
  const router = useRouter();
  const swapId = params.id as string;

  const { data: swap, isLoading } = useQuery({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch(`/api/swaps/${swapId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load swap");
      return res.json();
    },
    enabled: !!swapId && !!user,
  });

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (action: string, data?: any) => {
    if (!swap) return;
    setLoadingAction(action);

    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action, ...data }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Action failed");

      toast.success(result.message || "Action completed successfully");
      // Refresh swap data
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete action");
    } finally {
      setLoadingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Swap Details" />
        <div className="flex justify-center items-center py-20">
          <Loader2 size={32} className="animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  if (!swap) {
    return (
      <div>
        <Header title="Swap Details" />
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <X size={48} className="text-stone-300 mx-auto mb-4" />
            <h3 className="font-bold text-stone-700 mb-2">Swap not found</h3>
            <p className="text-sm text-stone-500">This swap may have been deleted or you don&apos;t have access to it.</p>
            <Button className="mt-4" onClick={() => router.push("/swaps")}>
              Back to Swaps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBuyer = user?.id === swap.buyer.id;
  const isCook = user?.id === swap.cook.id;
  const canConfirm = isCook && swap.status === "PENDING";
  const canPickup = (isBuyer || isCook) && swap.status === "CONFIRMED";
  const canCancel = (isBuyer || isCook) && ["PENDING", "CONFIRMED"].includes(swap.status);
  const canRate = isBuyer && swap.status === "PICKED_UP" && !swap.rating;

  const getStatusBadge = () => {
    switch (swap.status) {
      case "PENDING":
        return { color: "bg-amber-100 text-amber-700", icon: "⏳", label: "Pending" };
      case "CONFIRMED":
        return { color: "bg-blue-100 text-blue-700", icon: "✅", label: "Confirmed" };
      case "PICKED_UP":
        return { color: "bg-purple-100 text-purple-700", icon: "📦", label: "Picked Up" };
      case "COMPLETED":
        return { color: "bg-green-100 text-green-700", icon: "⭐", label: "Completed" };
      case "CANCELLED":
        return { color: "bg-red-100 text-red-700", icon: "❌", label: "Cancelled" };
      case "DISPUTED":
        return { color: "bg-orange-100 text-orange-700", icon: "⚠️", label: "Disputed" };
      default:
        return { color: "bg-stone-100 text-stone-700", icon: "❓", label: "Unknown" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div>
      <Header title="Swap Details" />

      <div className="px-4 py-6 space-y-6">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusBadge.color}`}>
          <span className="text-lg">{statusBadge.icon}</span>
          <span className="font-bold text-sm">{statusBadge.label}</span>
        </div>

        {/* Dish Information */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <div className="flex items-start gap-4">
            {swap.dish.image && (
              <img
                src={swap.dish.image}
                alt={swap.dish.title}
                className="w-24 h-24 rounded-xl object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-stone-800 text-lg">{swap.dish.title}</h3>
              <p className="text-sm text-stone-600 mt-1">{swap.dish.description}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <MapPin size={14} />
                  <span>{swap.dish.city}, {swap.dish.country}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <Calendar size={14} />
                  <span>{format(new Date(swap.dish.pickupFrom), "MMM d, h:mm a")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-stone-100 p-4">
            <p className="text-xs font-semibold text-stone-500 mb-2">BUYER</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                {swap.buyer.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-stone-800 text-sm">{swap.buyer.name}</p>
                <p className="text-xs text-stone-500">
                  {swap.buyer.totalSwaps} swaps
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-100 p-4">
            <p className="text-xs font-semibold text-stone-500 mb-2">COOK</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                {swap.cook.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-stone-800 text-sm">{swap.cook.name}</p>
                <p className="text-xs text-stone-500">
                  {swap.cook.totalSwaps} swaps
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
          <h4 className="font-bold text-stone-800 mb-2">Swap Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500">Type</p>
              <p className="font-semibold text-stone-800">{swap.type}</p>
            </div>
            <div>
              <p className="text-stone-500">Credits</p>
              <p className="font-semibold text-stone-800">{swap.creditAmount}</p>
            </div>
            <div>
              <p className="text-stone-500">Created</p>
              <p className="font-semibold text-stone-800">
                {formatDistanceToNow(new Date(swap.createdAt), { addSuffix: true })}
              </p>
            </div>
            {swap.confirmedAt && (
              <div>
                <p className="text-stone-500">Confirmed</p>
                <p className="font-semibold text-stone-800">
                  {formatDistanceToNow(new Date(swap.confirmedAt), { addSuffix: true })}
                </p>
              </div>
            )}
            {swap.pickedUpAt && (
              <div>
                <p className="text-stone-500">Picked Up</p>
                <p className="font-semibold text-stone-800">
                  {formatDistanceToNow(new Date(swap.pickedUpAt), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>
          {swap.message && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-stone-500 text-xs mb-1">Message</p>
              <p className="text-sm text-stone-700 italic">{swap.message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {canConfirm && (
            <Button
              fullWidth
              onClick={() => handleAction("confirm")}
              loading={loadingAction === "confirm"}
            >
              <Check size={18} className="mr-2" />
              Confirm Swap
            </Button>
          )}
          {canPickup && (
            <Button
              fullWidth
              onClick={() => handleAction("pickup")}
              loading={loadingAction === "pickup"}
            >
              <Check size={18} className="mr-2" />
              Confirm Pickup
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                const reason = prompt("Reason for cancellation (optional):");
                if (reason !== null) {
                  handleAction("cancel", { cancelReason: reason });
                }
              }}
              loading={loadingAction === "cancel"}
            >
              <X size={18} className="mr-2" />
              Cancel Swap
            </Button>
          )}
          {canRate && (
            <Button
              fullWidth
              onClick={() => {
                const score = prompt("Rate this swap (1-5):");
                if (score && !isNaN(parseInt(score)) && parseInt(score) >= 1 && parseInt(score) <= 5) {
                  const comment = prompt("Add a comment (optional):");
                  handleAction("rate", { score: parseInt(score), comment });
                }
              }}
              loading={loadingAction === "rate"}
            >
              <Star size={18} className="mr-2" />
              Rate Swap
            </Button>
          )}
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <ChatBubble
            swapId={swapId}
            otherUser={isBuyer ? swap.cook : swap.buyer}
          />
        </div>
      </div>
    </div>
  );
}
