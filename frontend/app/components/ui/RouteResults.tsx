"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Loader2, Map, MapPin, Navigation, Route as RouteIcon, Save, TriangleAlert } from "lucide-react";
import TriplyLogo from "../shared/TriplyLogo";

const routeColors = ["#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316", "#60a5fa", "#e879f9"];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Waypoint = {
  id?: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  order_index: number;
  arrival_time?: string | null;
  departure_time?: string | null;
  schedule_label?: string;
  transit_to_next?: { transit_mode: string; travel_duration_minutes: number } | null;
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
  navigation_url?: string | null;
  initial_budget?: number | null;
};

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding: [number, number]; maxZoom?: number }) => LeafletMap;
  invalidateSize: () => LeafletMap;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (content: string) => LeafletMarker;
  openPopup: () => LeafletMarker;
  setIcon: (icon: unknown) => LeafletMarker;
};

type LeafletApi = {
  map: (element: HTMLDivElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  polyline: (points: [number, number][], options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void; getBounds: () => unknown };
  marker: (point: [number, number], options?: Record<string, unknown>) => LeafletMarker;
  divIcon: (options: Record<string, unknown>) => unknown;
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

function isParkingWaypoint(waypoint: Waypoint) {
  return /parking|garage/i.test(waypoint.category);
}

function parkingIcon(leaflet: LeafletApi) {
  return leaflet.divIcon({
    className: "triply-parking-marker",
    html: '<span aria-label="Parking">P</span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function selectedParkingIcon(leaflet: LeafletApi) {
  return leaflet.divIcon({
    className: "triply-parking-marker triply-marker-selected",
    html: '<span aria-label="Selected parking">P</span>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function stopIcon(leaflet: LeafletApi, color: string) {
  return leaflet.divIcon({
    className: "triply-stop-marker",
    html: `<span style="background:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function selectedStopIcon(leaflet: LeafletApi, color: string) {
  return leaflet.divIcon({
    className: "triply-stop-marker triply-marker-selected",
    html: `<span style="background:${color}"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function RouteResults({ route, onBack }: { route: RouteData; onBack: () => void }) {
  const timelineRef = useRef<HTMLElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markerRecords = useRef<Record<string, { marker: LeafletMarker; normalIcon: unknown; selectedIcon: unknown }>>({});
  const selectedMarkerKey = useRef<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const orderedWaypoints = [...route.waypoints].sort((first, second) => first.order_index - second.order_index);
  const dailyRoutes = route.itineraries?.length ? route.itineraries.map((itinerary) => ({ day: itinerary.day, waypoints: [itinerary.start, ...itinerary.stops, itinerary.final_destination] })) : [{ day: 1, waypoints: orderedWaypoints }];
  const mapWaypoints = dailyRoutes.flatMap((dailyRoute) => dailyRoute.waypoints);
  const estimatedCost = mapWaypoints.reduce((total, waypoint) => total + (waypoint.estimated_cost ?? 0), 0);
  const remainingBudget = Math.max(0, (route.initial_budget ?? 0) - estimatedCost);
  const fatigueWarnings = dailyRoutes.map((dailyRoute) => {
    let walkingLegs = 0;
    return dailyRoute.waypoints.slice(0, -1).map((waypoint, index) => {
      const isWalking = waypoint.transit_to_next?.transit_mode === "walking" || waypoint.transit_to_next?.transit_mode === "foot";
      walkingLegs = isWalking ? walkingLegs + 1 : 0;
      const next = dailyRoute.waypoints[index + 1];
      const warning = walkingLegs >= 3 && !/cafe|restaurant|dining|coffee/i.test(next.category);
      return warning ? index + 1 : null;
    }).filter((index): index is number => index !== null);
  });

  function buildMapsUrl() {
    if (mapWaypoints.length < 2) return "";
    const coordinates = mapWaypoints.map((waypoint) => `${waypoint.latitude},${waypoint.longitude}`);
    const params = new URLSearchParams({ api: "1", origin: coordinates[0], destination: coordinates.at(-1) ?? coordinates[0], travelmode: "walking" });
    if (coordinates.length > 2) params.set("waypoints", coordinates.slice(1, -1).join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  async function downloadBoardingPass() {
    if (!timelineRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf().set({
      margin: 0.35,
      filename: `${route.city.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-boarding-pass.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#040814", useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    }).from(timelineRef.current).save();
  }

  async function saveCurrentRoute() {
    const token = localStorage.getItem("triply_token");
    if (!token) return;
    setSaveState("saving");
    try {
      const response = await fetch(`${API_URL}/api/v1/routes/save`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: route.title, city: route.city, payload: route }) });
      if (!response.ok) throw new Error("Unable to save this route.");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  useEffect(() => {
    let isActive = true;
    setIsMapLoading(true);
    setMapError("");
    async function drawRoute() {
      if (!mapElement.current || mapWaypoints.length === 0) return;
      try {
        const leaflet = await loadLeaflet();
        if (!isActive || !mapElement.current) return;
        const map = leaflet.map(mapElement.current, { zoomControl: true, scrollWheelZoom: true });
        mapInstance.current = map;
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);

        const waypointPoints = mapWaypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number]);
        dailyRoutes.forEach((dailyRoute, dayIndex) => dailyRoute.waypoints.forEach((waypoint, index) => {
          const markerKey = `${dailyRoute.day}-${index}`;
          const color = routeColors[(dayIndex + index) % routeColors.length];
          const normalIcon = isParkingWaypoint(waypoint) ? parkingIcon(leaflet) : stopIcon(leaflet, color);
          const selectedIcon = isParkingWaypoint(waypoint) ? selectedParkingIcon(leaflet) : selectedStopIcon(leaflet, color);
          const marker = leaflet.marker([waypoint.latitude, waypoint.longitude], { icon: normalIcon }).addTo(map).bindPopup(`<strong>${index + 1}. ${escapePopupText(waypoint.name)}</strong><br>${escapePopupText(waypoint.category)}`);
          markerRecords.current[markerKey] = { marker, normalIcon, selectedIcon };
        }));
        const dayRoutes = await Promise.all(dailyRoutes.map(async (dailyRoute) => {
          const dayPoints = dailyRoute.waypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number]);
          const segments = await Promise.all(dailyRoute.waypoints.slice(0, -1).map(async (waypoint, index) => {
            const nextWaypoint = dailyRoute.waypoints[index + 1];
            const coordinates = `${waypoint.longitude},${waypoint.latitude};${nextWaypoint.longitude},${nextWaypoint.latitude}`;
            try {
              const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`);
              if (!response.ok) throw new Error("The route service is unavailable.");
              const data = await response.json();
              const points = data.routes?.[0]?.geometry?.coordinates?.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as [number, number]) ?? [dayPoints[index], dayPoints[index + 1]];
              return { points, color: routeColors[(index + dailyRoutes.indexOf(dailyRoute)) % routeColors.length] };
            } catch {
              return { points: [dayPoints[index], dayPoints[index + 1]], color: routeColors[(index + dailyRoutes.indexOf(dailyRoute)) % routeColors.length] };
            }
          }));
          return { day: dailyRoute.day, segments };
        }));
        if (!isActive) return;
        dayRoutes.forEach((dayRoute) => {
          dayRoute.segments.forEach((segment) => {
            leaflet.polyline(segment.points, { color: segment.color, weight: 8, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
          });
        });
        map.fitBounds(leaflet.latLngBounds(waypointPoints), { padding: [40, 40], maxZoom: 13 });
        const pendingMarkerKey = selectedMarkerKey.current;
        if (pendingMarkerKey && markerRecords.current[pendingMarkerKey]) {
          const pendingRecord = markerRecords.current[pendingMarkerKey];
          const [pendingDay, pendingIndex] = pendingMarkerKey.split("-").map(Number);
          const pendingWaypoint = dailyRoutes.find((dailyRoute) => dailyRoute.day === pendingDay)?.waypoints[pendingIndex];
          pendingRecord.marker.setIcon(pendingRecord.selectedIcon).openPopup();
          if (pendingWaypoint) map.setView([pendingWaypoint.latitude, pendingWaypoint.longitude], 17);
        }
        map.invalidateSize();
        window.setTimeout(() => {
          if (isActive) map.invalidateSize();
        }, 250);
        if (isActive) setIsMapLoading(false);
      } catch (error) {
        if (isActive) {
          setMapError(error instanceof Error ? error.message : "Unable to load the map.");
          setIsMapLoading(false);
        }
      }
    }

    drawRoute();
    return () => {
      isActive = false;
      markerRecords.current = {};
      selectedMarkerKey.current = null;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [route]);

  const focusStop = (dailyRoute: typeof dailyRoutes[number], index: number) => {
    const waypoint = dailyRoute.waypoints[index];
    const markerKey = `${dailyRoute.day}-${index}`;
    const previousKey = selectedMarkerKey.current;
    if (previousKey && markerRecords.current[previousKey]) {
      markerRecords.current[previousKey].marker.setIcon(markerRecords.current[previousKey].normalIcon);
    }
    const record = markerRecords.current[markerKey];
    if (record) {
      record.marker.setIcon(record.selectedIcon).openPopup();
      mapInstance.current?.setView([waypoint.latitude, waypoint.longitude], 17);
    }
    selectedMarkerKey.current = markerKey;
    setSelectedStop(markerKey);
  };

  return (
    <main className="min-h-screen bg-[#040814] text-slate-200">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <TriplyLogo />
        <div className="flex flex-wrap items-center justify-end gap-3"><button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-cyan-200"><ArrowLeft size={16} /> Plan another route</button><button type="button" onClick={saveCurrentRoute} disabled={saveState === "saving" || saveState === "saved"} className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-cyan-300 hover:text-cyan-200 disabled:opacity-60"><Save size={16} />{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Retry save" : "Save route"}</button><button type="button" onClick={downloadBoardingPass} className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-300/20"><Download size={16} /> Download Boarding Pass (PDF)</button><a href={buildMapsUrl()} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"><Map size={16} /> Launch in Google Maps</a></div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-78px)] max-w-[1500px] grid-cols-1 lg:grid-cols-[40%_60%]">
        <section ref={timelineRef} className="order-2 flex flex-col border-r border-white/10 bg-[#040814] px-6 py-8 lg:order-1 lg:px-10 lg:py-12">
          <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Your route is ready</p><h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{route.title}</h1><p className="mt-3 text-slate-400">{route.city} · {orderedWaypoints.length} stops across {dailyRoutes.length} {dailyRoutes.length === 1 ? "day" : "days"}</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400"><span className="font-semibold uppercase tracking-wider text-slate-500">Daily routes</span>{dailyRoutes.map((dailyRoute, index) => <span key={dailyRoute.day} className="inline-flex items-center gap-1.5"><span style={{ backgroundColor: routeColors[index % routeColors.length] }} className="size-2 rounded-full" />Day {dailyRoute.day}</span>)}</div></div>
          <div className="mb-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Trip Summary</p><p className="mt-2 text-sm text-slate-400">Estimated remaining budget</p><p className="mt-1 text-2xl font-semibold text-white">{remainingBudget.toFixed(0)} LEI</p><p className="mt-1 text-xs text-slate-500">Estimated spend: {estimatedCost.toFixed(0)} LEI</p></div>{fatigueWarnings.some((warnings) => warnings.length > 0) && <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"><TriangleAlert size={16} /> Fatigue warning</p><p className="mt-2 text-sm">High Fatigue Zone: Consider adding a rest stop here.</p></div>}</div>
          <div className="relative flex-1">
            {dailyRoutes.map((dailyRoute, dayIndex) => <div key={dailyRoute.day} className="mb-10 last:mb-0"><div className="mb-5 flex items-center gap-3"><span style={{ backgroundColor: routeColors[dayIndex % routeColors.length] }} className="size-3 rounded-full" /><h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Day {dailyRoute.day}</h2><span className="text-xs text-slate-500">{dailyRoute.waypoints.length} stops</span></div>{dailyRoute.waypoints.map((waypoint, index) => { const markerKey = `${dailyRoute.day}-${index}`; const parking = isParkingWaypoint(waypoint); const warning = fatigueWarnings[dayIndex].includes(index); return <div key={`${dailyRoute.day}-${waypoint.name}-${index}`} className="relative flex gap-4 pb-8 last:pb-0"><div className="relative flex w-8 shrink-0 justify-center"><span style={{ borderColor: routeColors[dayIndex % routeColors.length], color: routeColors[dayIndex % routeColors.length] }} className="z-10 grid size-8 place-items-center rounded-full border bg-slate-950 text-sm font-semibold">{index + 1}</span>{index < dailyRoute.waypoints.length - 1 && <span style={{ backgroundColor: routeColors[dayIndex % routeColors.length] }} className="absolute top-8 h-full w-px opacity-70" />}</div><button type="button" onClick={() => focusStop(dailyRoute, index)} className={`min-w-0 flex-1 rounded-2xl border p-3 text-left transition-all ${selectedStop === markerKey ? "border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.14)]" : "border-transparent hover:border-white/15 hover:bg-white/5"}`} aria-label={`Show ${waypoint.name} on map`}><p className={`text-xs font-semibold uppercase tracking-[0.16em] ${parking ? "text-orange-300" : "text-slate-500"}`}>{parking ? "P · Parking" : waypoint.category}</p><h3 className="mt-1 text-lg font-medium text-white">{waypoint.name}</h3>{waypoint.schedule_label && <p className="mt-1 text-sm font-semibold text-cyan-200">{waypoint.schedule_label}</p>}<p className="mt-1 text-xs text-slate-500">{waypoint.travel_minutes_from_previous ? `${waypoint.travel_minutes_from_previous} min travel` : "Starting point"}{waypoint.transit_to_next ? ` · next: ${waypoint.transit_to_next.transit_mode} ${waypoint.transit_to_next.travel_duration_minutes} min` : ""}</p>{warning && <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-300"><TriangleAlert size={13} /> Rest/Coffee break recommended here</span>}</button></div>; })}</div>)}
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 text-sm text-slate-400"><RouteIcon className="mb-3 text-cyan-300" size={20} /><p>Drag the map to explore the route. Use the + and - controls or your mouse wheel to zoom.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Map data by OpenStreetMap <ExternalLink size={12} /></a></div>
        </section>
        <section className="order-1 relative min-h-[55vh] overflow-hidden bg-slate-900 lg:order-2 lg:min-h-0"><div ref={mapElement} className="absolute inset-0" />{isMapLoading && !mapError && <div className="absolute inset-0 z-[450] grid place-items-center bg-slate-950/35 backdrop-blur-[2px]"><div className="rounded-3xl border border-white/15 bg-slate-950/90 px-7 py-6 text-center shadow-2xl"><Loader2 className="mx-auto animate-spin text-cyan-300" size={30} /><p className="mt-4 text-sm font-semibold text-white">Opening your route map</p><p className="mt-1 text-xs text-slate-400">Plotting every stop and parking point...</p></div></div>}{mapError && <div className="absolute inset-x-6 top-6 z-[500] rounded-2xl border border-rose-300/30 bg-slate-950/90 p-4 text-sm text-rose-200 shadow-xl">{mapError} The stops are still listed on the left.</div>}{mapWaypoints.length === 0 && <div className="absolute inset-0 grid place-items-center text-slate-400">No map points were returned for this route.</div>}<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/50 to-transparent" /><div className="absolute bottom-5 left-5 z-[400] flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/85 px-3 py-2 text-xs text-slate-300 backdrop-blur-md"><span className="flex items-center gap-1.5"><MapPin size={14} className="text-cyan-300" /> Stops</span><span className="flex items-center gap-1.5"><span className="grid size-4 place-items-center rounded-full bg-orange-500 text-[10px] font-black text-white">P</span> Parking</span></div></section>
      </div>
    </main>
  );
}
