"use client";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { LatLngBoundsExpression } from "leaflet";
import { BRAND } from "@/lib/brand";

export interface GeoMapProps {
  center: { lat: number; lng: number };
  radius: number;
  orgName: string;
  user?: { lat: number; lng: number; accuracy: number } | null;
  inside?: boolean;
}

function FitBounds({ center, user }: Pick<GeoMapProps, "center" | "user">) {
  const map = useMap();
  useEffect(() => {
    if (!user) return;
    const bounds: LatLngBoundsExpression = [
      [Math.min(center.lat, user.lat), Math.min(center.lng, user.lng)],
      [Math.max(center.lat, user.lat), Math.max(center.lng, user.lng)],
    ];
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
  }, [map, center.lat, center.lng, user]);
  return null;
}

/** خريطة النطاق الجغرافي: دائرة الجهة (أخضر) + موقع الطالب ودقته */
export default function GeoMap({ center, radius, orgName, user, inside }: GeoMapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={17} scrollWheelZoom={false} className="h-64 w-full md:h-80" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={[center.lat, center.lng]} radius={radius} pathOptions={{ color: BRAND.navy, fillColor: BRAND.teal, fillOpacity: 0.15, weight: 2 }}>
        <Tooltip direction="top">{orgName}</Tooltip>
      </Circle>
      <CircleMarker center={[center.lat, center.lng]} radius={5} pathOptions={{ color: BRAND.teal, fillColor: BRAND.teal, fillOpacity: 1 }} />
      {user && (
        <>
          <Circle center={[user.lat, user.lng]} radius={user.accuracy} pathOptions={{ color: "#2563eb", fillOpacity: 0.08, weight: 1, dashArray: "4" }} />
          <CircleMarker
            center={[user.lat, user.lng]}
            radius={8}
            pathOptions={{ color: "#fff", weight: 3, fillColor: inside ? "#2563eb" : "#dc2626", fillOpacity: 1 }}
          >
            <Tooltip direction="bottom">موقعك الحالي</Tooltip>
          </CircleMarker>
        </>
      )}
      <FitBounds center={center} user={user} />
    </MapContainer>
  );
}
