"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, MapPin, Route as RouteIcon } from "lucide-react";
import TriplyLogo from "../shared/TriplyLogo";

const routeColors = ["#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316", "#60a5fa", "#e879f9"];

export type Waypoint = {
  id?: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  order_index: number;
};

export type DailyItinerary = {
  day: number;
  start: Waypoint;
  stops: Waypoint[];
  final_destination: Waypoint;
};

export type RouteData = {
  title: string;
  city: string;
  waypoints: Waypoint[];
  itineraries?: DailyItinerary[];
};

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding: [number, number] }) => LeafletMap;
  remove: () => void;
};

type LeafletApi = {
  map: (element: HTMLDivElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  polyline: (points: [number, number][], options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void; getBounds: () => unknown };
  marker: (point: [number, number], options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => { bindPopup: (content: string) => void } };
  latLngBounds: (points: [number, number][]) => unknown;
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

function loadLeaflet(): Promise<LeafletApi> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-leaflet]");
    if (existingScript) {
      existingScript.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Map library failed to load.")));
      existingScript.addEventListener("error", () => reject(new Error("Map library failed to load.")));
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(stylesheet);

    const script = document.createElement("script");
    script.dataset.leaflet = "true";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Map library failed to load."));
    script.onerror = () => reject(new Error("Map library failed to load."));
    document.body.appendChild(script);
  });
}

function escapePopupText(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);
}

export default function RouteResults({ route, onBack }: { route: RouteData; onBack: () => void }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const [mapError, setMapError] = useState("");
  const orderedWaypoints = [...route.waypoints].sort((first, second) => first.order_index - second.order_index);
  const dailyRoutes = route.itineraries?.length ? route.itineraries.map((itinerary) => ({ day: itinerary.day, waypoints: [itinerary.start, ...itinerary.stops, itinerary.final_destination] })) : [{ day: 1, waypoints: orderedWaypoints }];

  useEffect(() => {
    let isActive = true;
    async function drawRoute() {
      if (!mapElement.current || orderedWaypoints.length === 0) return;
      try {
        const leaflet = await loadLeaflet();
        if (!isActive || !mapElement.current) return;
        const map = leaflet.map(mapElement.current, { zoomControl: true, scrollWheelZoom: true });
        mapInstance.current = map;
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);

        const waypointPoints = dailyRoutes.flatMap((dailyRoute) => dailyRoute.waypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number]));
        dailyRoutes.forEach((dailyRoute) => dailyRoute.waypoints.forEach((waypoint, index) => {
          leaflet.marker([waypoint.latitude, waypoint.longitude]).addTo(map).bindPopup(`<strong>${index + 1}. ${escapePopupText(waypoint.name)}</strong><br>${escapePopupText(waypoint.category)}`);
        }));

        const dayRoutes = await Promise.all(dailyRoutes.map(async (dailyRoute) => {
          const dayPoints = dailyRoute.waypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number]);
          const coordinates = dailyRoute.waypoints.map((waypoint) => [waypoint.longitude, waypoint.latitude]).join(";");
          try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`);
            if (!response.ok) throw new Error("The route service is unavailable.");
            const data = await response.json();
            const points = data.routes?.[0]?.geometry?.coordinates?.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as [number, number]) ?? dayPoints;
            return { day: dailyRoute.day, points };
          } catch {
            return { day: dailyRoute.day, points: dayPoints };
          }
        }));
        if (!isActive) return;
        dayRoutes.forEach((dayRoute, index) => {
          leaflet.polyline(dayRoute.points, { color: routeColors[index % routeColors.length], weight: 8, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
        });
        map.fitBounds(leaflet.latLngBounds(waypointPoints), { padding: [40, 40] });
      } catch (error) {
        if (isActive) setMapError(error instanceof Error ? error.message : "Unable to load the map.");
      }
    }

    drawRoute();
    return () => {
      isActive = false;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [route, dailyRoutes]);

  return (
    <main className="min-h-screen bg-[#040814] text-slate-200">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <TriplyLogo />
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-cyan-200"><ArrowLeft size={16} /> Plan another route</button>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-78px)] max-w-[1500px] grid-cols-1 lg:grid-cols-[40%_60%]">
        <section className="order-2 flex flex-col border-r border-white/10 px-6 py-8 lg:order-1 lg:px-10 lg:py-12">
          <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Your route is ready</p><h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{route.title}</h1><p className="mt-3 text-slate-400">{route.city} · {orderedWaypoints.length} stops across {dailyRoutes.length} {dailyRoutes.length === 1 ? "day" : "days"}</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400"><span className="font-semibold uppercase tracking-wider text-slate-500">Daily routes</span>{dailyRoutes.map((dailyRoute, index) => <span key={dailyRoute.day} className="inline-flex items-center gap-1.5"><span style={{ backgroundColor: routeColors[index % routeColors.length] }} className="size-2 rounded-full" />Day {dailyRoute.day}</span>)}</div></div>
          <div className="relative flex-1">
            {dailyRoutes.map((dailyRoute, dayIndex) => <div key={dailyRoute.day} className="mb-10 last:mb-0"><div className="mb-5 flex items-center gap-3"><span style={{ backgroundColor: routeColors[dayIndex % routeColors.length] }} className="size-3 rounded-full" /><h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Day {dailyRoute.day}</h2><span className="text-xs text-slate-500">{dailyRoute.waypoints.length} stops</span></div>{dailyRoute.waypoints.map((waypoint, index) => <div key={`${dailyRoute.day}-${waypoint.name}-${index}`} className="relative flex gap-4 pb-8 last:pb-0"><div className="relative flex w-8 shrink-0 justify-center"><span style={{ borderColor: routeColors[dayIndex % routeColors.length], color: routeColors[dayIndex % routeColors.length] }} className="z-10 grid size-8 place-items-center rounded-full border bg-slate-950 text-sm font-semibold">{index + 1}</span>{index < dailyRoute.waypoints.length - 1 && <span style={{ backgroundColor: routeColors[dayIndex % routeColors.length] }} className="absolute top-8 h-full w-px opacity-70" />}</div><div className="min-w-0 pt-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{waypoint.category}</p><h3 className="mt-1 text-lg font-medium text-white">{waypoint.name}</h3><p className="mt-1 text-xs text-slate-500">{waypoint.latitude.toFixed(4)}, {waypoint.longitude.toFixed(4)}</p></div></div>)}</div>)}
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 text-sm text-slate-400"><RouteIcon className="mb-3 text-cyan-300" size={20} /><p>Drag the map to explore the route. Use the + and - controls or your mouse wheel to zoom.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Map data by OpenStreetMap <ExternalLink size={12} /></a></div>
        </section>
        <section className="order-1 relative min-h-[55vh] overflow-hidden bg-slate-900 lg:order-2 lg:min-h-0"><div ref={mapElement} className="absolute inset-0" />{mapError && <div className="absolute inset-x-6 top-6 z-[500] rounded-2xl border border-rose-300/30 bg-slate-950/90 p-4 text-sm text-rose-200 shadow-xl">{mapError} The stops are still listed on the left.</div>}{orderedWaypoints.length === 0 && <div className="absolute inset-0 grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>}<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/50 to-transparent" /><div className="absolute bottom-5 left-5 z-[400] flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 backdrop-blur-md"><MapPin size={14} className="text-cyan-300" /> Interactive route map</div></section>
      </div>
    </main>
  );
}
