"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";

// Dynamically import Leaflet map to avoid SSR issues
const TrackMap = dynamic(() => import("@/app/swaps/[id]/track/TrackMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-stone-100 dark:bg-stone-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
        <p className="text-stone-600 dark:text-stone-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function TrackBuyerPage() {
  const { user } = useAppStore();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const swapId = params.id as string;

  const [buyerLocation, setBuyerLocation] = useState<[number, number] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [cookLocation, setCookLocation] = useState<[number, number] | null>(null);

  // Fetch swap details
  const { data: swapData, isLoading } = useQuery({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch(`/api/swaps/${swapId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load swap");
      return res.json();
    },
    enabled: !!user && !!swapId,
  });

  const swap = swapData;

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Get cook location
  useEffect(() => {
    if (!swap || swap.cookId !== user?.id) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation: [number, number] = [latitude, longitude];
        setCookLocation(newLocation);

        // If we have buyer location, calculate distance from cook to buyer
        if (buyerLocation) {
          const dist = calculateDistance(latitude, longitude, buyerLocation[0], buyerLocation[1]);
          setDistance(dist);
          const estimatedMinutes = (dist / 1000) / 15 * 60;
          setEta(estimatedMinutes);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to get your location. Please enable GPS.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [swap, user?.id, buyerLocation]);

  // Poll the buyer latest location (REST — Socket.IO live push was removed;
  // the buyer POSTs to /api/swaps/[id]/location every 4s and the cook polls
  // GET on the same route). Matches the buyer broadcast interval.
  useEffect(() => {
    if (!swap || swap.cookId !== user?.id) return;

    let cancelled = false;

    const fetchLocation = async () => {
      try {
        const res = await fetch(`/api/swaps/${swapId}/location`, { credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.location) return;

        const newLocation: [number, number] = [data.location.lat, data.location.lng];
        setBuyerLocation(newLocation);
        setLastUpdate(data.timestamp || new Date().toISOString());

        // Calculate distance from cook to buyer
        if (cookLocation) {
          const dist = calculateDistance(cookLocation[0], cookLocation[1], newLocation[0], newLocation[1]);
          setDistance(dist);
          const estimatedMinutes = (dist / 1000) / 15 * 60;
          setEta(estimatedMinutes);
        }
      } catch {
        // Polling failure is non-fatal; the next tick retries.
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [swap, swapId, user?.id, cookLocation]);

  // Handle call buyer
  const handleCall = () => {
    if (!swap?.buyer?.phone) return;
    window.location.href = `tel:${swap.buyer.phone}`;
  };

  // Handle navigate to buyer
  const handleNavigate = () => {
    if (!cookLocation || !buyerLocation) return;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${cookLocation[0]},${cookLocation[1]}&destination=${buyerLocation[0]},${buyerLocation[1]}&travelmode=walking`;
    window.open(url, "_blank");
  };

  // Handle confirm pickup (cook can also confirm)
  const handleConfirmPickup = async () => {
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action: "pickup" }),
      });

      if (!res.ok) throw new Error("Failed to confirm pickup");

      toast.success("🎉 Pickup confirmed! Credits transferred.");
      router.push("/swaps");
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm pickup");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100 dark:bg-stone-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-stone-600 dark:text-stone-400">Loading swap details...</p>
        </div>
      </div>
    );
  }

  if (!swap) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100 dark:bg-stone-900">
        <div className="text-center px-4">
          <div className="text-5xl mb-4">❌</div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-2">Swap not found</h3>
          <button
            onClick={() => router.push("/swaps")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
          >
            Back to Swaps
          </button>
        </div>
      </div>
    );
  }

  // Only cook can track buyer
  if (swap.cookId !== user?.id) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100 dark:bg-stone-900">
        <div className="text-center px-4">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-2">Access Denied</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">Only the cook can track the buyer&apos;s location.</p>
          <button
            onClick={() => router.push("/swaps")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
          >
            Back to Swaps
          </button>
        </div>
      </div>
    );
  }

  const dishLocation: [number, number] = [swap.dish.latitude, swap.dish.longitude];

  return (
    <div className="h-screen flex flex-col bg-stone-100 dark:bg-stone-900">
      {/* Map container */}
      <div className="flex-1 relative">
        {cookLocation && buyerLocation ? (
          <TrackMap
            buyerLocation={buyerLocation}
            dishLocation={dishLocation}
            cookLocation={cookLocation}
            theme={theme}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-stone-200 dark:bg-stone-800">
            <div className="text-center">
              <div className="animate-pulse text-5xl mb-4">📍</div>
              <p className="text-stone-600 dark:text-stone-400">
                {!cookLocation ? "Getting your location..." : "Waiting for buyer&apos;s location..."}
              </p>
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-1000 bg-white dark:bg-stone-800 p-2 rounded-full shadow-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
        >
          <svg className="w-6 h-6 text-stone-700 dark:text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Live tracking indicator */}
        {buyerLocation && (
          <div className="absolute top-4 right-4 z-1000 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live tracking
          </div>
        )}
      </div>

      {/* Bottom info panel */}
      <div className="bg-white dark:bg-stone-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 space-y-4">
        {/* Buyer info */}
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-3xl shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg leading-tight">
              {swap.buyer.name}
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              Delivering <strong>{swap.dish.title}</strong>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                Buyer
              </span>
              {swap.creditAmount > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                  {swap.creditAmount} credits
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Distance and ETA */}
        {buyerLocation && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Distance to Buyer</div>
            </div>
            <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {eta < 1 ? "< 1 min" : `${Math.round(eta)} min`}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">ETA</div>
            </div>
          </div>
        )}

        {/* Last update */}
        {lastUpdate && (
          <div className="text-center text-xs text-stone-500 dark:text-stone-400">
            Buyer location updated: {new Date(lastUpdate).toLocaleTimeString()}
          </div>
        )}
        {!buyerLocation && (
          <div className="text-center text-xs text-stone-500 dark:text-stone-400">
            Waiting for buyer to share location...
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCall}
            className="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 py-3 rounded-xl font-semibold hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call Buyer
          </button>
          <button
            onClick={handleNavigate}
            disabled={!cookLocation || !buyerLocation}
            className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
              cookLocation && buyerLocation
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-stone-300 dark:bg-stone-600 text-stone-500 cursor-not-allowed"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
            </svg>
            Navigate
          </button>
          {buyerLocation && distance < 50 && (
            <button
              onClick={handleConfirmPickup}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 animate-pulse"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Pickup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
