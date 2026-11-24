"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

// Dynamic import to avoid SSR issues with Leaflet
let leafletLoaded = false;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  category: string;
  status: string;
  cookName: string;
  priceCredits: number;
  isFree: boolean;
  image?: string;
}

interface DishMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (id: string) => void;
  userLocation?: { lat: number; lng: number };
  className?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  MAIN_COURSE: "🍛", APPETIZER: "🥗", DESSERT: "🍰",
  BREAKFAST: "🍳", SNACK: "🍿", BEVERAGE: "☕",
  BAKED_GOODS: "🥐", SOUP: "🍲", SALAD: "🥙", OTHER: "🍽️",
};

const STATUS_BORDER: Record<string, string> = {
  AVAILABLE: "#16a34a",
  RESERVED: "#d97706",
  PICKED_UP: "#2563eb",
  COMPLETED: "#78716c",
};

export function DishMap({
  markers,
  center,
  zoom = 14,
  height = "300px",
  onMarkerClick,
  userLocation,
  className = "",
}: DishMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    // Dynamically import leaflet
    import("leaflet").then((L) => {
      // Fix leaflet default icon paths in Next.js
      if (!leafletLoaded) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
        leafletLoaded = true;
      }

      // Destroy previous map instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const mapCenter = center ?? userLocation ?? { lat: 33.6938, lng: 73.0652 };

      const map = L.map(mapRef.current!, {
        center: [mapCenter.lat, mapCenter.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // User location marker
      if (userLocation) {
        const userIcon = L.divIcon({
          html: `<div style="
            width:14px;height:14px;
            background:#16a34a;
            border:3px solid white;
            border-radius:50%;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindTooltip("You are here", { permanent: false, direction: "top" });
      }

      // Dish markers
      markersRef.current = markers.map((m) => {
        const borderColor = STATUS_BORDER[m.status] ?? "#78716c";
        const emoji = CATEGORY_EMOJI[m.category] ?? "🍽️";
        const price = m.isFree ? "Free" : `${m.priceCredits}cr`;

        const icon = L.divIcon({
          html: `
            <div style="
              background:white;
              border:3px solid ${borderColor};
              border-radius:12px;
              padding:4px 6px;
              display:flex;
              align-items:center;
              gap:3px;
              box-shadow:0 2px 8px rgba(0,0,0,0.15);
              white-space:nowrap;
              font-family:sans-serif;
              font-size:11px;
              font-weight:700;
              cursor:pointer;
            ">
              <span style="font-size:14px">${emoji}</span>
              <span style="color:#1c1917">${price}</span>
            </div>
          `,
          className: "",
          iconAnchor: [20, 16],
        });

        const marker = L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px;font-family:sans-serif">
              <p style="font-weight:700;font-size:13px;margin:0 0 4px">${m.title}</p>
              <p style="font-size:11px;color:#78716c;margin:0 0 2px">by ${m.cookName}</p>
              <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
                <span style="
                  background:${borderColor}22;
                  color:${borderColor};
                  font-size:10px;font-weight:700;
                  padding:2px 8px;border-radius:99px
                ">${m.status.replace("_", " ")}</span>
                <span style="font-size:11px;font-weight:700;color:#16a34a">
                  ${m.isFree ? "💚 Free" : `${m.priceCredits} credits`}
                </span>
              </div>
            </div>
          `);

        if (onMarkerClick) {
          marker.on("click", () => onMarkerClick(m.id));
        }

        return marker;
      });

      mapInstanceRef.current = map;
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [markers.length, center?.lat, center?.lng, userLocation?.lat, userLocation?.lng]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stone-100 ${className}`} style={{ height }}>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      {markers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <MapPin size={28} className="text-stone-300 mx-auto mb-1" />
            <p className="text-xs text-stone-400 font-medium">No dishes on map</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Pickup location picker for post/edit forms
export function LocationPicker({
  value,
  onChange,
  height = "220px",
}: {
  value: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number }) => void;
  height?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      if (mapInstanceRef.current) return;

      const initialCenter = value ?? { lat: 33.6938, lng: 73.0652 };

      const map = L.map(mapRef.current!, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: 15,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
        });
      }

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", (ev: any) => {
            const pos = ev.target.getLatLng();
            onChange({ lat: pos.lat, lng: pos.lng });
          });
        }
        onChange({ lat, lng });
      });

      mapInstanceRef.current = map;
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-stone-400 font-medium">
        {value ? `📍 ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Tap on map to set pickup location"}
      </p>
      <div
        ref={mapRef}
        style={{ height, width: "100%" }}
        className="rounded-xl overflow-hidden border border-stone-200"
      />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
    </div>
  );
}
