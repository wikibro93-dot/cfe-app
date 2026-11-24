"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";

// Dynamically import Leaflet map to avoid SSR issues
const NavigateMap = dynamic(() => import("./NavigateMap"), {
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

export default function NavigatePage() {
  const { token, user } = useAppStore();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const swapId = params.id as string;

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch swap details
  const { data: swapData, isLoading } = useQuery({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      const res = await fetch(`/api/swaps/${swapId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load swap");
      return res.json();
    },
    enabled: !!token && !!swapId,
  });

  const swap = swapData?.swap;

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
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

  // Calculate ETA based on speed
  const calculateETA = (distanceMeters: number, speedKmh: number): number => {
    if (speedKmh < 1) {
      // Fallback to walking speed (15 km/h)
      return (distanceMeters / 1000) / 15 * 60; // Minutes
    }
    return (distanceMeters / 1000) / speedKmh * 60; // Minutes
  };

  // Start GPS tracking
  useEffect(() => {
    if (!swap) return;

    const dishLocation: [number, number] = [swap.dish.latitude, swap.dish.longitude];

    // Watch position with high accuracy
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading: gpsHeading, speed: gpsSpeed } = position.coords;
        const newLocation: [number, number] = [latitude, longitude];

        setUserLocation(newLocation);
        setHeading(gpsHeading || 0);
        setSpeed((gpsSpeed || 0) * 3.6); // Convert m/s to km/h

        // Calculate distance
        const dist = calculateDistance(latitude, longitude, dishLocation[0], dishLocation[1]);
        setDistance(dist);

        // Calculate ETA
        const estimatedMinutes = calculateETA(dist, (gpsSpeed || 0) * 3.6);
        setEta(estimatedMinutes);

        // Check arrival (30 meters threshold)
        if (dist < 30 && !hasArrived) {
          setHasArrived(true);
          toast.success("🎉 You've arrived!", {
            duration: 5000,
            style: {
              background: "#14532d",
              color: "#dcfce7",
            },
          });
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
  }, [swap, hasArrived]);

  // Broadcast location to cook every 4 seconds
  useEffect(() => {
    if (!userLocation || !swap || swap.status !== "CONFIRMED") return;

    const broadcastLocation = async () => {
      try {
        await fetch(`/api/swaps/${swapId}/location`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            lat: userLocation[0],
            lng: userLocation[1],
          }),
        });
      } catch (error) {
        console.error("Failed to broadcast location:", error);
      }
    };

    // Broadcast immediately, then every 4 seconds
    broadcastLocation();
    broadcastIntervalRef.current = setInterval(broadcastLocation, 4000);
    setIsBroadcasting(true);

    return () => {
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
      setIsBroadcasting(false);
    };
  }, [userLocation, swap, swapId, token]);

  // Handle navigate to Google Maps
  const handleNavigate = () => {
    if (!userLocation || !swap) return;

    const dishLocation = [swap.dish.latitude, swap.dish.longitude];
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${dishLocation[0]},${dishLocation[1]}&travelmode=walking`;
    window.open(url, "_blank");
  };

  // Handle call cook
  const handleCall = () => {
    if (!swap?.cook?.phone) return;
    window.location.href = `tel:${swap.cook.phone}`;
  };

  // Handle confirm pickup
  const handleConfirmPickup = async () => {
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  const dishLocation: [number, number] = [swap.dish.latitude, swap.dish.longitude];

  return (
    <div className="h-screen flex flex-col bg-stone-100 dark:bg-stone-900">
      {/* Map container */}
      <div className="flex-1 relative">
        {userLocation ? (
          <NavigateMap
            userLocation={userLocation}
            dishLocation={dishLocation}
            heading={heading}
            hasArrived={hasArrived}
            theme={theme}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-stone-200 dark:bg-stone-800">
            <div className="text-center">
              <div className="animate-pulse text-5xl mb-4">📍</div>
              <p className="text-stone-600 dark:text-stone-400">Getting your location...</p>
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-[1000 bg-white dark:bg-stone-800 p-2 rounded-full shadow-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
        >
          <svg className="w-6 h-6 text-stone-700 dark:text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Broadcasting indicator */}
        {isBroadcasting && (
          <div className="absolute top-4 right-4 z-1000 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live tracking
          </div>
        )}
      </div>

      {/* Bottom info panel */}
      <div className="bg-white dark:bg-stone-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 space-y-4">
        {/* Dish info */}
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
            {swap.dish.image ? (
              <img src={swap.dish.image} alt="" className="w-full h-full object-cover" />
            ) : "🍽️"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg leading-tight">{swap.dish.title}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              From <strong>{swap.cook.name}</strong>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                {swap.type}
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
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Distance</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {eta < 1 ? "< 1 min" : `${Math.round(eta)} min`}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">ETA</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCall}
            className="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 py-3 rounded-xl font-semibold hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
          </button>
          <button
            onClick={handleNavigate}
            disabled={!userLocation}
            className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
              userLocation
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-stone-300 dark:bg-stone-600 text-stone-500 cursor-not-allowed"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
            </svg>
            Navigate
          </button>
          {hasArrived && (
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
