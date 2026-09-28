"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BRAND } from "@/lib/brand";

// علامة قابلة للسحب بدون ملفات صور (تجنب مشكلة أيقونات Leaflet مع الـ bundler)
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z" fill="${BRAND.navy}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="${BRAND.tealBright}"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

interface Props {
  latitude: number;
  longitude: number;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}

function ClickToPlace({ onChange }: Pick<Props, "onChange">) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** يعيد تمركز الخريطة عند تغيير الإحداثيات من خارجها (لصق رابط / موقعي الحالي) */
function Recenter({ latitude, longitude }: Pick<Props, "latitude" | "longitude">) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().pad(-0.2).contains([latitude, longitude])) map.setView([latitude, longitude], Math.max(map.getZoom(), 17));
  }, [map, latitude, longitude]);
  return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export default function LocationPickerMap({ latitude, longitude, radius, onChange }: Props) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const p = (e.target as L.Marker).getLatLng();
        onChange(round6(p.lat), round6(p.lng));
      },
    }),
    [onChange]
  );
  const place = (lat: number, lng: number) => onChange(round6(lat), round6(lng));

  return (
    <MapContainer center={[latitude, longitude]} zoom={17} className="h-80 w-full rounded-lg md:h-[420px]" scrollWheelZoom>
      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked name="خريطة">
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="قمر صناعي">
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Circle center={[latitude, longitude]} radius={radius} pathOptions={{ color: BRAND.navy, fillColor: BRAND.teal, fillOpacity: 0.15, weight: 2 }} />
      <Marker position={[latitude, longitude]} draggable icon={pinIcon} eventHandlers={handlers} />
      <ClickToPlace onChange={place} />
      <Recenter latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}
