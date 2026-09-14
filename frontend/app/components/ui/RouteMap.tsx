"use client";

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface Waypoint {
  id?: number | null;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  order_index: number;
  arrival_time?: string | null;
  departure_time?: string | null;
  schedule_label?: string | null;
  estimated_cost?: number | null;
  travel_minutes_from_previous?: number | null;
}

interface RouteMapProps {
  waypoints: Waypoint[];
}

const SEGMENT_COLORS = [
  '#FFD60A',
  '#0A84FF',
  '#32D74B',
  '#BF5AF2',
  '#FF9F0A',
  '#FF375F',
  '#64D2FF',
];

const CATEGORY_COLORS: Record<string, string> = {
  start_point: '#32D74B',
  end_point: '#FF453A',
  parking: '#8E8E93',
  restaurant: '#FF9F0A',
  cafe: '#FF9F0A',
  default: '#0A84FF',
};

function makeDivIcon(label: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      color:#000;
      width:28px;height:28px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      border:2px solid rgba(0,0,0,0.5);
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ waypoints }: { waypoints: Waypoint[] }) {
  const map = useMap();

  useEffect(() => {
    const valid = waypoints.filter(wp => wp.latitude !== 0 && wp.longitude !== 0);
    if (valid.length === 0) return;

    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 15);
      return;
    }

    const bounds = L.latLngBounds(valid.map(wp => [wp.latitude, wp.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [waypoints, map]);

  return null;
}

export default function RouteMap({ waypoints }: RouteMapProps) {
  const sorted = useMemo(
    () => [...waypoints].sort((a, b) => a.order_index - b.order_index),
    [waypoints]
  );

  const segments = useMemo(() => {
    const result: { positions: [number, number][]; color: string }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.latitude === 0 && a.longitude === 0) continue;
      if (b.latitude === 0 && b.longitude === 0) continue;
      result.push({
        positions: [[a.latitude, a.longitude], [b.latitude, b.longitude]],
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      });
    }
    return result;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1c1c1e] rounded-2xl text-[#8e8e93]">
        No stops to display for this day.
      </div>
    );
  }

  const center: [number, number] = [sorted[0].latitude, sorted[0].longitude];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={true}
      className="w-full h-full rounded-2xl z-0"
      style={{ background: '#1c1c1e' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <FitBounds waypoints={sorted} />

      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 5, opacity: 0.9 }}
        />
      ))}

      {sorted.map((wp, i) => {
        const color = CATEGORY_COLORS[wp.category] ?? CATEGORY_COLORS.default;
        const label = wp.category === 'start_point' ? 'A'
          : wp.category === 'end_point' ? 'B'
          : wp.category === 'parking' ? 'P'
          : `${i + 1}`;
        return (
          <Marker
            key={wp.id ?? i}
            position={[wp.latitude, wp.longitude]}
            icon={makeDivIcon(label, color)}
          />
        );
      })}
    </MapContainer>
  );
}