"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface NavigateMapProps {
  userLocation: [number, number];
  dishLocation: [number, number];
  heading: number;
  hasArrived: boolean;
  theme: string | undefined;
}

export default function NavigateMap({
  userLocation,
  dishLocation,
  heading,
  hasArrived,
  theme,
}: NavigateMapProps) {
  const userMarkerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Custom user marker with directional arrow
  const createUserIcon = () => {
    return L.divIcon({
      className: "custom-user-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: ${hasArrived ? "#22c55e" : "#3b82f6"};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 22h20L12 2z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Custom dish marker
  const createDishIcon = () => {
    return L.divIcon({
      className: "custom-dish-marker",
      html: `
        <div style="
          width: 50px;
          height: 50px;
          background: ${hasArrived ? "#22c55e" : "#f97316"};
          border: 3px solid white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        ">
          🍽️
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });
  };

  // Update user marker rotation when heading changes
  useEffect(() => {
    if (userMarkerRef.current) {
      const icon = createUserIcon();
      userMarkerRef.current.setIcon(icon);
    }
  }, [heading, hasArrived]);

  // Fit bounds to show both markers
  useEffect(() => {
    if (mapRef.current) {
      const bounds = L.latLngBounds([userLocation, dishLocation]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [userLocation, dishLocation]);

  // Tile layer URL based on theme
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={userLocation}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      ref={(map) => {
        if (map) mapRef.current = map;
      }}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
        keepBuffer={4}
      />

      {/* User marker with directional arrow */}
      <Marker
        position={userLocation}
        icon={createUserIcon()}
        ref={userMarkerRef}
      >
        <Popup>
          <div className="text-center">
            <div className="font-bold text-lg">You</div>
            <div className="text-sm text-stone-600">
              {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Dish location marker */}
      <Marker position={dishLocation} icon={createDishIcon()}>
        <Popup>
          <div className="text-center">
            <div className="font-bold text-lg">🍽️ Pickup Location</div>
            <div className="text-sm text-stone-600">
              {dishLocation[0].toFixed(4)}, {dishLocation[1].toFixed(4)}
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Route line */}
      <Polyline
        positions={[userLocation, dishLocation]}
        color={hasArrived ? "#22c55e" : "#3b82f6"}
        weight={4}
        opacity={0.7}
        dashArray={hasArrived ? undefined : "10, 10"}
      />

      {/* Arrival circle (30m radius) */}
      {hasArrived && (
        <Circle
          center={dishLocation}
          radius={30}
          fillColor="#22c55e"
          fillOpacity={0.2}
          color="#22c55e"
          weight={2}
        />
      )}
    </MapContainer>
  );
}
