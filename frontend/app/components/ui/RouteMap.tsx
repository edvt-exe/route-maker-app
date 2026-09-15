"use client";

import React, { useEffect, useMemo, useState } from 'react';
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
  transit_to_next?: { transit_mode: string } | null;
}

interface RouteMapProps {
  waypoints: Waypoint[];
  selectedStopId?: string | null;
  onStopSelect?: (stopId: string) => void;
}

function normalizeStopId(wp: Waypoint, fallbackIndex: number): string {
  if (wp.id !== null && wp.id !== undefined && wp.id !== 0) {
    return String(wp.id);
  }
  return `order-${wp.order_index ?? fallbackIndex}`;
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

const OSRM_PROFILE: Record<string, string> = {
  walking: 'foot',
  'by car': 'driving',
};

async function fetchRoadRoute(
  a: [number, number],
  b: [number, number],
  profile: string
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length === 0) return null;
    const road = coords.map(c => [c[1], c[0]] as [number, number]);
    return [a, ...road.slice(1, -1), b];
  } catch {
    return null;
  }
}

function makeDivIcon(label: string, color: string, selected = false) {
  const size = selected ? 32 : 28;
  const border = selected ? '4px solid rgba(255,255,255,0.95)' : '2px solid rgba(0,0,0,0.5)';
  const shadow = selected ? '0 0 0 4px rgba(10,132,255,0.45), 0 6px 12px rgba(0,0,0,0.45)' : '0 2px 6px rgba(0,0,0,0.4)';

  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      color:#000;
      width:${size}px;height:${size}px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:${selected ? 13 : 12}px;font-weight:800;
      border:${border};
      box-shadow:${shadow};
      transform: translateY(${selected ? '-2px' : '0px'});
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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

function FocusSelectedStop({
  waypoints,
  selectedStopId,
}: {
  waypoints: Waypoint[];
  selectedStopId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedStopId) return;

    const selected = waypoints.find((wp, index) => normalizeStopId(wp, index) === selectedStopId);
    if (!selected) return;

    const hasCoords = selected.latitude !== 0 || selected.longitude !== 0;
    if (!hasCoords) return;

    map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    });
  }, [map, selectedStopId, waypoints]);

  return null;
}

interface Segment {
  positions: [number, number][];
  color: string;
}

export default function RouteMap({ waypoints, selectedStopId, onStopSelect }: RouteMapProps) {
  const sorted = useMemo(
    () => [...waypoints].sort((a, b) => a.order_index - b.order_index),
    [waypoints]
  );

  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    const validWaypoints = sorted.filter(wp => wp.latitude !== 0 || wp.longitude !== 0);
    const routeSegments = validWaypoints.slice(0, -1).map((wp, i) => ({
      a: [wp.latitude, wp.longitude] as [number, number],
      b: [validWaypoints[i + 1].latitude, validWaypoints[i + 1].longitude] as [number, number],
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      mode: wp.transit_to_next?.transit_mode,
    }));

    let cancelled = false;

    const run = async () => {
      if (!cancelled) setSegments([]);

      const resolved: Segment[] = [];
      for (const segment of routeSegments) {
        if (cancelled) return;

        const profile = OSRM_PROFILE[segment.mode ?? ''] ?? 'driving';
        const road = await fetchRoadRoute(segment.a, segment.b, profile);

        if (cancelled) return;

        if (road) {
          resolved.push({ positions: road, color: segment.color });
          if (!cancelled) setSegments([...resolved]);
        }

        await new Promise(r => setTimeout(r, 350));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
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
    <div className="dark-map-wrapper w-full h-full">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full rounded-2xl z-0"
        style={{ background: '#1c1c1e' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <FitBounds waypoints={sorted} />
        <FocusSelectedStop waypoints={sorted} selectedStopId={selectedStopId ?? null} />

        {segments.map((seg, i) => (
          <Polyline
            key={i}
            positions={seg.positions}
            pathOptions={{ color: seg.color, weight: 5, opacity: 0.9 }}
          />
        ))}

        {sorted.map((wp, i) => {
          const color = CATEGORY_COLORS[wp.category] ?? CATEGORY_COLORS.default;
          const stopId = normalizeStopId(wp, i);
          const isSelected = stopId === (selectedStopId ?? null);
          const label = `${i + 1}`;

          return (
            <Marker
              key={stopId}
              position={[wp.latitude, wp.longitude]}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => {
                  if (onStopSelect) onStopSelect(stopId);
                },
              }}
              icon={makeDivIcon(label, color, isSelected)}
            />
          );
        })}
      </MapContainer>

      <style jsx global>{`
        .dark-map-wrapper .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.85) saturate(0.9);
        }
      `}</style>
    </div>
  );
}