"use client";

import { useState } from "react";
import { MapPin, Clock, Star, Zap, Heart } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n";
import { haversineDistance } from "@/lib/geo";
import Link from "next/link";
import Image from "next/image";

interface DishCardProps {
  dish: {
    id: string;
    title: string;
    description?: string;
    image?: string;
    category: string;
    servings: number;
    priceCredits: number;
    priceMoney?: number;
    currency?: string;
    status: string;
    pickupFrom: string;
    pickupTo: string;
    latitude: number;
    longitude: number;
    city: string;
    isSwappable: boolean;
    isFree: boolean;
    tags: string[];
    cook: {
      id: string;
      name: string;
      avatar?: string;
      isVerifiedCook: boolean;
      badges: string[];
    };
    _count?: { swaps: number };
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  MAIN_COURSE: "🍛",
  APPETIZER: "🥗",
  DESSERT: "🍰",
  BREAKFAST: "🍳",
  SNACK: "🍿",
  BEVERAGE: "☕",
  BAKED_GOODS: "🥐",
  SOUP: "🍲",
  SALAD: "🥙",
  OTHER: "🍽️",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  RESERVED: "bg-amber-100 text-amber-700",
  PICKED_UP: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-stone-100 text-stone-600",
};

function formatPickupTime(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const prefix = isToday(fromDate) ? "Today" : isTomorrow(fromDate) ? "Tomorrow" : format(fromDate, "MMM d");
  return `${prefix} ${format(fromDate, "h:mm")}–${format(toDate, "h:mma")}`;
}

export function DishCard({ dish }: DishCardProps) {
  const { language, userLocation } = useAppStore();
  const [imageError, setImageError] = useState(false);

  const distance = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lng, dish.latitude, dish.longitude)
    : null;

  const isHot = dish._count && dish._count.swaps >= 2;

  return (
    <Link href={`/dish/${dish.id}`} className="block group">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-stone-100 group-hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative h-44 bg-gradient-to-br from-green-50 to-emerald-100 overflow-hidden">
          {dish.image && !imageError ? (
            <Image
              src={dish.image}
              alt={dish.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl">{CATEGORY_EMOJI[dish.category] || "🍽️"}</span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[dish.status] || "bg-stone-100 text-stone-600"}`}>
              {dish.status.replace("_", " ")}
            </span>
          </div>

          {/* Hot badge */}
          {isHot && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              🔥 Hot
            </div>
          )}

          {/* Free badge */}
          {dish.isFree && (
            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              FREE
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-stone-900 leading-tight line-clamp-2 text-sm">
              {dish.title}
            </h3>
            <div className="shrink-0 text-right">
              {dish.isFree ? (
                <span className="text-green-600 font-bold text-sm">Free</span>
              ) : (
                <span className="text-green-600 font-bold text-sm">{dish.priceCredits} cr</span>
              )}
            </div>
          </div>

          {/* Cook info */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
              {dish.cook.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-stone-500 font-medium truncate">{dish.cook.name}</span>
            {dish.cook.isVerifiedCook && (
              <span className="text-xs" title="Verified Cook">✓</span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-stone-400 font-medium">
            <div className="flex items-center gap-1">
              <Clock size={11} />
              <span className="truncate">{formatPickupTime(dish.pickupFrom, dish.pickupTo)}</span>
            </div>
            {distance !== null && (
              <div className="flex items-center gap-1 shrink-0">
                <MapPin size={11} />
                <span>{distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {dish.isSwappable && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={10} /> Swappable
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function DishCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
      <div className="h-44 animate-shimmer" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 animate-shimmer rounded w-3/4" />
        <div className="h-3 animate-shimmer rounded w-1/2" />
        <div className="h-3 animate-shimmer rounded w-2/3" />
      </div>
    </div>
  );
}
