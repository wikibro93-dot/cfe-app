"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Users, Star, Zap, MessageSquare } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import dynamic from "next/dynamic";

const DishMap = dynamic(
  () => import("@/components/map/DishMap").then((m) => m.DishMap),
  { ssr: false, loading: () => <div className="h-48 animate-shimmer rounded-2xl" /> }
);

const CATEGORY_EMOJI: Record<string, string> = {
  MAIN_COURSE: "🍛", APPETIZER: "🥗", DESSERT: "🍰", BREAKFAST: "🍳",
  SNACK: "🍿", BEVERAGE: "☕", BAKED_GOODS: "🥐", SOUP: "🍲", SALAD: "🥙", OTHER: "🍽️",
};

export default function DishDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAppStore();

  const [swapType, setSwapType] = useState<"CREDITS" | "DIRECT" | "FREE">("CREDITS");
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  const { data: dish, isLoading } = useQuery({
    queryKey: ["dish", id],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch(`/api/dishes/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Dish not found");
      return res.json();
    },
  });

  const handleRequestSwap = async () => {
    if (!user) { router.push("/login"); return; }
    setRequesting(true);
    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dishId: id, type: swapType, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Swap requested! 🎉");
      setShowSwapModal(false);
      router.push("/swaps");
    } catch (err: any) {
      toast.error(err.message || "Failed to request swap");
    } finally {
      setRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-float text-4xl">🍽️</div>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500">Dish not found</p>
          <Link href="/feed"><Button className="mt-4">Back to Feed</Button></Link>
        </div>
      </div>
    );
  }

  const isOwnDish = user?.id === dish.cookId;
  const isAvailable = dish.status === "AVAILABLE";
  const canSwap = isAvailable && !isOwnDish;

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Image hero */}
      <div className="relative h-64 bg-gradient-to-br from-green-50 to-emerald-100">
        {dish.image ? (
          <img src={dish.image} alt={dish.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl">{CATEGORY_EMOJI[dish.category] || "🍽️"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md"
        >
          <ArrowLeft size={18} className="text-stone-700" />
        </button>
        <div className="absolute bottom-4 left-4">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            isAvailable ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"
          }`}>
            {dish.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Title + price */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-playfair font-bold text-2xl text-stone-900">{dish.title}</h1>
            <p className="text-stone-500 text-sm mt-1">{dish.description}</p>
          </div>
          <div className="text-right shrink-0">
            {dish.isFree ? (
              <span className="text-green-600 font-bold text-xl">Free 💚</span>
            ) : (
              <span className="text-green-600 font-bold text-xl">{dish.priceCredits} cr</span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Clock, label: "Pickup", value: `${format(new Date(dish.pickupFrom), "MMM d h:mma")} – ${format(new Date(dish.pickupTo), "h:mma")}` },
            { icon: MapPin, label: "Location", value: dish.city },
            { icon: Users, label: "Servings", value: `${dish.servings} servings` },
            { icon: Star, label: "Category", value: `${CATEGORY_EMOJI[dish.category]} ${dish.category.replace("_", " ")}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-xl p-3 border border-stone-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-green-600" />
                <span className="text-xs font-semibold text-stone-400">{label}</span>
              </div>
              <p className="text-sm font-bold text-stone-800 leading-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* Ingredients */}
        {dish.ingredients?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-stone-100">
            <h3 className="font-bold text-stone-700 mb-3 text-sm">🧄 Ingredients</h3>
            <div className="flex flex-wrap gap-2">
              {dish.ingredients.map((ing: string) => (
                <span key={ing} className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cook profile */}
        <div className="bg-white rounded-2xl p-4 border border-stone-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg shrink-0">
            {dish.cook?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-stone-800">{dish.cook?.name}</p>
              {dish.cook?.isVerifiedCook && (
                <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">✓ Cook</span>
              )}
            </div>
            <p className="text-xs text-stone-400">{dish.cook?.totalSwaps || 0} swaps completed</p>
          </div>
        </div>

        {/* Pickup map */}
        {dish.latitude && dish.longitude && (
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">📍 Pickup Location</p>
            <DishMap
              markers={[{ id: dish.id, lat: dish.latitude, lng: dish.longitude, title: dish.title, category: dish.category, status: dish.status, cookName: dish.cook?.name ?? "", priceCredits: dish.priceCredits, isFree: dish.isFree }]}
              center={{ lat: dish.latitude, lng: dish.longitude }}
              zoom={15}
              height="200px"
            />
          </div>
        )}

        {/* Swap options + badges */}
        <div className="flex gap-2 flex-wrap">
          {dish.isSwappable && (
            <span className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full">
              <Zap size={12} /> Direct Swap
            </span>
          )}
          {dish.isFree && (
            <span className="bg-green-50 text-green-600 text-xs font-bold px-3 py-1.5 rounded-full">💚 Free</span>
          )}
        </div>

        {/* CTA */}
        {canSwap && (
          <div className="space-y-3">
            {!showSwapModal ? (
              <Button fullWidth size="lg" onClick={() => setShowSwapModal(true)}>
                🔄 Request Swap
              </Button>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-stone-100 space-y-4">
                <h3 className="font-bold text-stone-800">Request Swap</h3>

                {/* Swap type */}
                <div className="flex gap-2">
                  {[
                    { type: "CREDITS", label: `${dish.priceCredits} Credits`, show: !dish.isFree },
                    { type: "DIRECT", label: "Direct Swap", show: dish.isSwappable },
                    { type: "FREE", label: "Free", show: dish.isFree },
                  ].filter(t => t.show).map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => setSwapType(type as any)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                        swapType === type
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-stone-200 text-stone-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <Input
                  placeholder="Add a message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  leftIcon={<MessageSquare size={14} />}
                />

                {swapType === "CREDITS" && (
                  <p className="text-xs text-stone-400">
                    Your balance: <strong>{user?.credits || 0} credits</strong> → will deduct {dish.priceCredits} credits
                  </p>
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowSwapModal(false)} fullWidth>
                    Cancel
                  </Button>
                  <Button onClick={handleRequestSwap} loading={requesting} fullWidth>
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isOwnDish && (
          <div className="bg-green-50 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-green-700">This is your dish</p>
            <Link href={`/dish/${id}/edit`}>
              <Button variant="outline" size="sm" className="mt-2">Edit Dish</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
