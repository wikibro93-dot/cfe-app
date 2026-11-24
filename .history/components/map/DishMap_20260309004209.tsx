"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  dynamicMode?: boolean;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
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

const TILE_LAYERS = {
  clean: {
    name: "Clean",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  street: {
    name: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap contributors &copy; OpenTopoMap',
  },
};

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function DishMap({
  markers,
  center,
  zoom = 14,
  height = "300px",
  onMarkerClick,
  userLocation,
  className = "",
  dynamicMode = false,
  onBoundsChange,
}: DishMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const tileLayersRef = useRef<any>({});
  const [currentTileLayer, setCurrentTileLayer] = useState<keyof typeof TILE_LAYERS>("clean");
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced bounds change handler
  const debouncedBoundsChange = useCallback(
    debounce((bounds: { north: number; south: number; east: number; west: number }) => {
      if (onBoundsChange) {
        onBoundsChange(bounds);
        setIsLoading(true);
      }
    }, 350),
    [onBoundsChange]
  );

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

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

      // Add tile layers
      Object.entries(TILE_LAYERS).forEach(([key, layer]) => {
        const tileLayer = L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: 19,
          keepBuffer: 4, // Pre-load tiles outside viewport
        });
        tileLayersRef.current[key as keyof typeof TILE_LAYERS] = tileLayer;
        
        if (key === currentTileLayer) {
          tileLayer.addTo(map);
        }
      });

      // User location marker with animated pulse
      if (userLocation) {
        const userIcon = L.divIcon({
          html: `
            <div style="
              position: relative;
              width: 20px;
              height: 20px;
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 14px;
                height: 14px;
                background: #16a34a;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                z-index: 2;
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
                background: rgba(22, 163, 74, 0.3);
                border-radius: 50%;
                animation: pulse 2s ease-out infinite;
                z-index: 1;
              "></div>
              <style>
                @keyframes pulse {
                  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
              </style>
            </div>
          `,
          className: "",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindTooltip("You are here", { permanent: false, direction: "top" });
      }

      // Dynamic mode: fetch dishes on bounds change
      if (dynamicMode && onBoundsChange) {
        const handleBoundsChange = () => {
          const bounds = map.getBounds();
          debouncedBoundsChange({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        };

        map.on('moveend', handleBoundsChange);
        map.on('zoomend', handleBoundsChange);
        
        // Initial fetch
        handleBoundsChange();
      }

      mapInstanceRef.current = map;
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      userMarkerRef.current = null;
    };
  }, [center?.lat, center?.lng, userLocation?.lat, userLocation?.lng, dynamicMode, onBoundsChange, debouncedBoundsChange]);

  // Update markers when they change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Create new markers
    markersRef.current = markers.map((m) => {
      const borderColor = STATUS_BORDER[m.status] ?? "#78716c";
      const emoji = CATEGORY_EMOJI[m.category] ?? "🍽️";
      const price = m.isFree ? "Free" : `${m.priceCredits}cr`;

      const icon = L.divIcon({
        html: `
          <div style="
            background: white;
            border: 3px solid ${borderColor};
            border-radius: 12px;
            padding: 4px 6px;
            display: flex;
            align-items: center;
            gap: 3px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            white-space: nowrap;
            font-family: sans-serif;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.2s ease;
          " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size: 14px">${emoji}</span>
            <span style="color: #1c1917">${price}</span>
          </div>
        `,
        className: "",
        iconAnchor: [20, 16],
      });

      const marker = L.marker([m.lat, m.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width: 180px; font-family: sans-serif;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">${m.title}</p>
            <p style="font-size: 12px; color: #78716c; margin: 0 0 8px;">by ${m.cookName}</p>
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
              <span style="
                background: ${borderColor}22;
                color: ${borderColor};
                font-size: 10px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 99px;
              ">${m.status.replace("_", " ")}</span>
              <span style="font-size: 12px; font-weight: 700; color: #16a34a;">
                ${m.isFree ? "💚 Free" : `${m.priceCredits} credits`}
              </span>
            </div>
            <button 
              onclick="window.location.href='/dish/${m.id}'"
              style="
                width: 100%;
                background: #16a34a;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s ease;
              "
              onmouseover="this.style.background='#15803d'"
              onmouseout="this.style.background='#16a34a'"
            >
              View Dish →
            </button>
          </div>
        `);

      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(m.id));
      }

      return marker;
    });

    setVisibleCount(markers.length);
    setIsLoading(false);
  }, [markers, onMarkerClick]);

  // Switch tile layer
  const switchTileLayer = (layerKey: keyof typeof TILE_LAYERS) => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Remove current layer
    const currentLayer = tileLayersRef.current[currentTileLayer];
    if (currentLayer) {
      map.removeLayer(currentLayer);
    }
    
    // Add new layer
    const newLayer = tileLayersRef.current[layerKey];
    if (newLayer) {
      newLayer.addTo(map);
    }
    
    setCurrentTileLayer(layerKey);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stone-100 ${className}`} style={{ height }}>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      
      {/* Tile layer switcher */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
        <div className="bg-white rounded-lg shadow-lg border border-stone-200 p-1">
          <button
            onClick={() => switchTileLayer("clean")}
            className={`px-3 py-2 text-xs font-semibold rounded transition-colors ${
              currentTileLayer === "clean" 
                ? "bg-green-600 text-white" 
                : "text-stone-600 hover:bg-stone-100"
            }`}
            title="Clean (Carto)"
          >
            Clean
          </button>
          <button
            onClick={() => switchTileLayer("street")}
            className={`px-3 py-2 text-xs font-semibold rounded transition-colors ${
              currentTileLayer === "street" 
                ? "bg-green-600 text-white" 
                : "text-stone-600 hover:bg-stone-100"
            }`}
            title="Street (OSM)"
          >
            Street
          </button>
          <button
            onClick={() => switchTileLayer("terrain")}
            className={`px-3 py-2 text-xs font-semibold rounded transition-colors ${
              currentTileLayer === "terrain" 
                ? "bg-green-600 text-white" 
                : "text-stone-600 hover:bg-stone-100"
            }`}
            title="Terrain"
          >
            Terrain
          </button>
        </div>
      </div>
      
      {/* Dish count indicator */}
      {dynamicMode && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-stone-200 px-3 py-2 z-[1000]">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-stone-700">
              {visibleCount} dish{visibleCount !== 1 ? "es" : ""} in this area
            </span>
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-stone-200 px-3 py-2 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-stone-600">Loading...</span>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {markers.length === 0 && !isLoading && (
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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        keepBuffer: 4,
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
