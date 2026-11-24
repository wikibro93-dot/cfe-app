"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Star, Loader2, X, Check, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function RateSwapPage() {
  const params = useParams();
  const { user } = useAppStore();
  const router = useRouter();
  const swapId = params.id as string;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

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

  if (isLoading) {
    return (
      <div>
        <Header title="Rate Swap" />
        <div className="flex justify-center items-center py-20">
          <Loader2 size={32} className="animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  if (!swap) {
    return (
      <div>
        <Header title="Rate Swap" />
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

  // Only buyer can rate the swap
  if (!isBuyer) {
    return (
      <div>
        <Header title="Rate Swap" />
        <div className="flex justify-center items-center py-20">
          <div className="text-center max-w-md">
            <X size={48} className="text-stone-300 mx-auto mb-4" />
            <h3 className="font-bold text-stone-700 mb-2">Access Denied</h3>
            <p className="text-sm text-stone-500 mb-4">
              Only the buyer can rate this swap.
            </p>
            <Button className="mt-4" onClick={() => router.push(`/swaps/${swapId}`)}>
              Back to Swap Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if swap can be rated
  if (swap.status !== "PICKED_UP") {
    return (
      <div>
        <Header title="Rate Swap" />
        <div className="flex justify-center items-center py-20">
          <div className="text-center max-w-md">
            <X size={48} className="text-stone-300 mx-auto mb-4" />
            <h3 className="font-bold text-stone-700 mb-2">Cannot Rate Yet</h3>
            <p className="text-sm text-stone-500 mb-4">
              This swap must be picked up before you can rate it.
            </p>
            <Button className="mt-4" onClick={() => router.push(`/swaps/${swapId}`)}>
              Back to Swap Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if already rated
  if (swap.rating) {
    return (
      <div>
        <Header title="Rate Swap" />
        <div className="flex justify-center items-center py-20">
          <div className="text-center max-w-md">
            <Check size={48} className="text-green-600 mx-auto mb-4" />
            <h3 className="font-bold text-stone-700 mb-2">Already Rated</h3>
            <p className="text-sm text-stone-500 mb-4">
              You have already rated this swap.
            </p>
            <Button className="mt-4" onClick={() => router.push(`/swaps/${swapId}`)}>
              Back to Swap Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action: "rate", score: rating, comment }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to submit rating");

      toast.success("Rating submitted successfully!");
      router.push(`/swaps/${swapId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Header title="Rate Swap" />
      
      {/* Back Button */}
      <div className="px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {/* Swap Info */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 mb-6">
          <div className="flex items-start gap-4">
            {swap.dish.image && (
              <img
                src={swap.dish.image}
                alt={swap.dish.title}
                className="w-20 h-20 rounded-xl object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-stone-800">{swap.dish.title}</h3>
              <p className="text-sm text-stone-600">
                {swap.dish.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                  {swap.cook.name[0].toUpperCase()}
                </div>
                <span className="text-sm text-stone-600">Cook: {swap.cook.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Form */}
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-6">
          <div>
            <h4 className="font-bold text-stone-800 text-lg mb-2">Rate Your Experience</h4>
            <p className="text-sm text-stone-600">
              How was your experience with this swap?
            </p>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-3">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={
                      star <= (hoveredStar || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-stone-200 text-stone-200"
                    }
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-stone-600 mt-2">
                You selected {rating} star{rating !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              maxLength={500}
              className="w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all resize-none"
            />
            <p className="text-xs text-stone-400 mt-1">
              {comment.length}/500 characters
            </p>
          </div>

          {/* Submit Button */}
          <Button
            fullWidth
            size="lg"
            onClick={handleSubmit}
            loading={submitting}
            disabled={rating === 0}
          >
            {submitting ? (
              <Loader2 size={18} className="mr-2" />
            ) : (
              <Star size={18} className="mr-2" />
            )}
            Submit Rating
          </Button>
        </div>
      </div>
    </div>
  );
}
