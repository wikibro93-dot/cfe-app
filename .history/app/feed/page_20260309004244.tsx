"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, Map, Grid3X3 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { DishCard, DishCardSkeleton } from "@/components/dishes/DishCard";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { AdvancedSearch, type SearchFilters } from "@/components/ui/AdvancedSearch";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

// Lazy-load map to avoid SSR issues
const DishMap = dynamic(
  () => import("@/components/map/DishMap").then((m) => m.DishMap),
  { ssr: false, loading: () => <div className="h-72 animate-shimmer rounded-2xl" /> }
);

const DEFAULT_FILTERS: SearchFilters = {
  search: "",
  category: "ALL",
  minCredits: "",
  maxCredits: "",
  isFree: false,
  isSwappable: false,
  sortBy: "recent",
  radius: 5,
};

async function fetchDishes(params: URLSearchParams) {
  const res = await fetch(`/api/dishes?${params}`);
  if (!res.ok) throw new Error("Failed to load dishes");
  return res.json();
}

async function fetchDishesByBounds(bounds: { north: number; south: number; east: number; west: number }) {
  const params = new URLSearchParams({
    north: bounds.north.toString(),
    south: bounds.south.toString(),
    east: bounds.east.toString(),
    west: bounds.west.toString(),
  });
  
  const res = await fetch(`/api/dishes/bounds?${params}`);
  if (!res.ok) throw new Error("Failed to load dishes in bounds");
  return res.json();
}

export default function FeedPage() {
  const { userLocation, setUserLocation, radius, setRadius } = useAppStore();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [locating, setLocating] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const router = useRouter();

  // Grid view: use radius-based API
  const queryParams = new URLSearchParams({
    ...(userLocation ? {
      lat: userLocation.lat.toString(),
      lng: userLocation.lng.toString(),
      radius: filters.radius.toString(),
    } : {}),
    ...(filters.category !== "ALL" ? { category: filters.category } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.isFree ? { isFree: "true" } : {}),
    ...(filters.isSwappable ? { isSwappable: "true" } : {}),
    ...(filters.minCredits ? { minCredits: filters.minCredits } : {}),
    ...(filters.maxCredits ? { maxCredits: filters.maxCredits } : {}),
    sortBy: filters.sortBy,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dishes", queryParams.toString()],
    queryFn: () => fetchDishes(queryParams),
    staleTime: 30000,
    enabled: viewMode === "grid", // Only fetch grid data when in grid view
  });

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location updated!");
      },
      () => { setLocating(false); toast.error("Could not get location"); }
    );
  }, [setUserLocation]);

  useEffect(() => { if (!userLocation) handleLocate(); }, []);

  const handleFiltersChange = (f: SearchFilters) => {
    setFilters(f);
    setRadius(f.radius);
  };

  // Map view: fetch dishes by bounds
  const handleBoundsChange = useCallback(async (bounds: { north: number; south: number; east: number; west: number }) => {
    try {
      setIsMapLoading(true);
      const data = await fetchDishesByBounds(bounds);
      const markers = data.dishes?.map((d: any) => ({
        id: d.id,
        lat: d.latitude,
        lng: d.longitude,
        title: d.title,
        category: d.category,
        status: d.status,
        cookName: d.cook?.name ?? "",
        priceCredits: d.priceCredits,
        isFree: d.isFree,
        image: d.image,
      })) || [];
      setMapMarkers(markers);
    } catch (error) {
      console.error("Error fetching dishes by bounds:", error);
      toast.error("Failed to load dishes");
    } finally {
      setIsMapLoading(false);
    }
  }, []);

  const dishes = data?.dishes || [];
  const total = data?.pagination?.total || dishes.length;

  return (
    <div>
      <Header
        title="Nearby Dishes"
        showLocation
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "map" : "grid")}
              className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title={viewMode === "grid" ? "Map view" : "Grid view"}
            >
              {viewMode === "grid"
                ? <Map size={18} className="text-stone-500" />
                : <Grid3X3 size={18} className="text-stone-500" />
              }
            </button>
            <button
              onClick={handleLocate}
              disabled={locating}
              className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <Navigation size={18} className={locating ? "animate-spin text-green-600" : "text-stone-500"} />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 space-y-3 sticky top-[61px] z-30 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur pb-3">
        <AdvancedSearch
          filters={filters}
          onChange={handleFiltersChange}
          resultCount={total}
        />
      </div>

      <div className="px-4 pt-2">
        {!userLocation && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
            <MapPin className="text-amber-500 shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Enable location</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">See dishes near you</p>
            </div>
            <Button size="sm" onClick={handleLocate} loading={locating}>Enable</Button>
          </div>
        )}

        {/* Map view */}
        {viewMode === "map" && (
          <div className="mb-4">
            <DishMap
              markers={mapMarkers}
              userLocation={userLocation ?? undefined}
              height="380px"
              onMarkerClick={(id) => router.push(`/dish/${id}`)}
            />
          </div>
        )}

        {/* Grid view */}
        {viewMode === "grid" && (
          isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <DishCardSkeleton key={i} />)}
            </div>
          ) : dishes.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4 animate-float">🍽️</div>
              <h3 className="font-bold text-stone-700 dark:text-stone-300 mb-1">No dishes found</h3>
              <p className="text-sm text-stone-400">Try adjusting your filters or radius</p>
              <Button className="mt-4" onClick={() => router.push("/post")}>Post a Dish</Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-400 font-semibold mb-3">{total} dishes found</p>
              <div className="grid grid-cols-2 gap-3">
                {dishes.map((dish: any, i: number) => (
                  <div key={dish.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in-up">
                    <DishCard dish={dish} />
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
