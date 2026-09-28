"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { BRAND } from "@/lib/brand";

export interface OverviewOrg { id: string; name: string; latitude: number; longitude: number; geofenceRadius: number; isApproved: boolean }

function FitAll({ orgs }: { orgs: OverviewOrg[] }) {
  const map = useMap();
  useEffect(() => {
    if (orgs.length) map.fitBounds(orgs.map((o) => [o.latitude, o.longitude] as [number, number]), { padding: [30, 30], maxZoom: 15 });
  }, [map, orgs]);
  return null;
}

/** خريطة عامة لكل الجهات — لاكتشاف الإحداثيات الخاطئة بنظرة واحدة */
export default function OrganizationsOverviewMap({ orgs, onSelect }: { orgs: OverviewOrg[]; onSelect: (id: string) => void }) {
  const center: [number, number] = orgs[0] ? [orgs[0].latitude, orgs[0].longitude] : [26.3292, 43.975];
  return (
    <MapContainer center={center} zoom={11} className="h-72 w-full rounded-lg" scrollWheelZoom={false}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {orgs.map((o) => (
        <Circle key={`${o.id}-r`} center={[o.latitude, o.longitude]} radius={o.geofenceRadius} pathOptions={{ color: BRAND.navy, weight: 1, fillOpacity: 0.1 }} />
      ))}
      {orgs.map((o) => (
        <CircleMarker
          key={o.id}
          center={[o.latitude, o.longitude]}
          radius={7}
          eventHandlers={{ click: () => onSelect(o.id) }}
          pathOptions={{ color: "#fff", weight: 2, fillColor: o.isApproved ? BRAND.navy : "#7b817e", fillOpacity: 1 }}
        >
          <Tooltip direction="top">{o.name}</Tooltip>
        </CircleMarker>
      ))}
      <FitAll orgs={orgs} />
    </MapContainer>
  );
}
