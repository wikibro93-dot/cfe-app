"use client";

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

interface TrackMapProps {
  buyerLocation: [number, number];
  dishLocation: [number, number];
  cookLocation: [number, number] | null;
  theme: string | undefined;
}

export default function TrackMap({
  buyerLocation,
  dishLocation,
  cookLocation,
  theme,
}: TrackMapProps) {
  // Custom cook marker
  const createCookIcon = () => {
    return L.divIcon({
      className: "custom-cook-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Custom buyer marker
  const createBuyerIcon = () => {
    return L.divIcon({
      className: "custom-buyer-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        </style>
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
          background: #f97316;
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

  // Tile layer URL based on theme
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  // Calculate map center - prioritize cook location, then buyer, then dish
  const mapCenter = cookLocation || buyerLocation || dishLocation;

  return (
    <MapContainer
      center={mapCenter}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
        keepBuffer={4}
      />

      {/* Cook marker */}
      {cookLocation && (
        <Marker position={cookLocation} icon={createCookIcon()}>
          <Popup>
            <div className="text-center">
              <div className="font-bold text-lg">👨‍🍳 You (Cook)</div>
              <div className="text-sm text-stone-600">
                {cookLocation[0].toFixed(4)}, {cookLocation[1].toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Buyer marker with pulse animation */}
      <Marker position={buyerLocation} icon={createBuyerIcon()}>
        <Popup>
          <div className="text-center">
            <div className="font-bold text-lg">👤 Buyer</div>
            <div className="text-sm text-stone-600">
              {buyerLocation[0].toFixed(4)}, {buyerLocation[1].toFixed(4)}
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

      {/* Route line from cook to buyer */}
      {cookLocation && (
        <Polyline
          positions={[cookLocation, buyerLocation]}
          color="#22c55e"
          weight={4}
          opacity={0.7}
          dashArray="10, 10"
        />
      )}

      {/* Arrival circle (50m radius around buyer) */}
      <Circle
        center={buyerLocation}
        radius={50}
        fillColor="#3b82f6"
        fillOpacity={0.1}
        color="#3b82f6"
        weight={2}
      />
    </MapContainer>
  );
}
