"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, ExternalLink, Loader2, Map, MapPin, Save, TriangleAlert, WalletCards } from "lucide-react";
import TriplyLogo from "../shared/TriplyLogo";

const routeColors = ["#0a84ff", "#32d74b", "#ff9f0a", "#bf5af2", "#ff375f", "#5e5ce6", "#64d2ff", "#ff453a"];
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
  estimated_cost?: number;
  travel_minutes_from_previous?: number;
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

// Flat iOS-style icons
function parkingIcon(leaflet: LeafletApi) {
  return leaflet.divIcon({
    className: "triply-marker",
    html: `<div style="background-color: #ff9f0a; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">P</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function selectedParkingIcon(leaflet: LeafletApi) {
  return leaflet.divIcon({
    className: "triply-marker-selected",
    html: `<div style="background-color: #ff9f0a; color: white; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">P</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function stopIcon(leaflet: LeafletApi, color: string) {
  return leaflet.divIcon({
    className: "triply-marker",
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function selectedStopIcon(leaflet: LeafletApi, color: string) {
  return leaflet.divIcon({
    className: "triply-marker-selected",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
      filename: `${route.city.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-itinerary.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#000000", useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    }).from(timelineRef.current).save();
  }

  async function saveCurrentRoute() {
    const token = localStorage.getItem("triply_token");
    if (!token) return;
    setSaveState("saving");
    try {
      const response = await fetch(`${API_URL}/api/v1/routes/save`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ title: route.title, city: route.city, payload: route }) 
      });
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
        
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
          attribution: "&copy; OpenStreetMap", 
          maxZoom: 19,
          className: 'dark-map-tiles'
        }).addTo(map);

        const waypointPoints = mapWaypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number]);
        
        dailyRoutes.forEach((dailyRoute, dayIndex) => dailyRoute.waypoints.forEach((waypoint, index) => {
          const markerKey = `${dailyRoute.day}-${index}`;
          const color = routeColors[(dayIndex) % routeColors.length];
          const normalIcon = isParkingWaypoint(waypoint) ? parkingIcon(leaflet) : stopIcon(leaflet, color);
          const selectedIcon = isParkingWaypoint(waypoint) ? selectedParkingIcon(leaflet) : selectedStopIcon(leaflet, color);
          
          const popupContent = `
            <div style="font-family: -apple-system, system-ui, sans-serif; background: #1c1c1e; color: white; padding: 4px; border-radius: 8px;">
              <strong style="font-size: 14px;">${index + 1}. ${escapePopupText(waypoint.name)}</strong><br>
              <span style="font-size: 12px; color: #8e8e93;">${escapePopupText(waypoint.category)}</span>
            </div>
          `;
          
          const marker = leaflet.marker([waypoint.latitude, waypoint.longitude], { icon: normalIcon }).addTo(map).bindPopup(popupContent);
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
              return { points, color: routeColors[dailyRoutes.indexOf(dailyRoute) % routeColors.length] };
            } catch {
              return { points: [dayPoints[index], dayPoints[index + 1]], color: routeColors[dailyRoutes.indexOf(dailyRoute) % routeColors.length] };
            }
          }));
          return { day: dailyRoute.day, segments };
        }));

        if (!isActive) return;
        dayRoutes.forEach((dayRoute) => {
          dayRoute.segments.forEach((segment) => {
            leaflet.polyline(segment.points, { color: segment.color, weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
          });
        });
        
        map.fitBounds(leaflet.latLngBounds(waypointPoints), { padding: [50, 50], maxZoom: 15 });
        
        const pendingMarkerKey = selectedMarkerKey.current;
        if (pendingMarkerKey && markerRecords.current[pendingMarkerKey]) {
          const pendingRecord = markerRecords.current[pendingMarkerKey];
          const [pendingDay, pendingIndex] = pendingMarkerKey.split("-").map(Number);
          const pendingWaypoint = dailyRoutes.find((dailyRoute) => dailyRoute.day === pendingDay)?.waypoints[pendingIndex];
          pendingRecord.marker.setIcon(pendingRecord.selectedIcon).openPopup();
          if (pendingWaypoint) map.setView([pendingWaypoint.latitude, pendingWaypoint.longitude], 16);
        }
        
        map.invalidateSize();
        window.setTimeout(() => { if (isActive) map.invalidateSize(); }, 250);
        
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
    <main className="min-h-screen bg-[#000000] text-white font-sans flex flex-col selection:bg-[#0a84ff] selection:text-white">
      <style dangerouslySetInnerHTML={{__html: `
        .dark-map-tiles { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(85%); }
        .leaflet-container { background: #000000 !important; font-family: inherit; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #1c1c1e; color: white; box-shadow: 0 4px 14px rgba(0,0,0,0.5); }
      `}} />

      <header className="sticky top-0 z-[100] flex items-center justify-between border-b border-[#38383a] bg-[#1c1c1e]/70 px-6 py-3.5 backdrop-blur-2xl">
        <TriplyLogo />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[15px] font-medium text-[#0a84ff] transition-colors hover:text-[#409cff]">
            <ChevronLeft size={20} className="-ml-1" /> Plan another route
          </button>
          
          <div className="hidden sm:flex items-center gap-2 border-l border-[#38383a] pl-4 ml-1">
            <button type="button" onClick={downloadBoardingPass} className="flex items-center gap-1.5 rounded-full bg-[#2c2c2e] px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-[#3a3a3c]">
              <Download size={15} /> PDF
            </button>
            <a href={buildMapsUrl()} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-[#2c2c2e] px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-[#3a3a3c]">
              <Map size={15} /> Open Maps
            </a>
            <button type="button" onClick={saveCurrentRoute} disabled={saveState === "saving" || saveState === "saved"} className="flex items-center gap-1.5 rounded-full bg-[#0a84ff] px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0071e3] disabled:opacity-60">
              <Save size={15} />
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Retry" : "Save Route"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[38%_62%] w-full h-[calc(100vh-61px)]">
        
        <section ref={timelineRef} className="order-2 lg:order-1 flex flex-col bg-[#000000] border-r border-[#38383a] overflow-y-auto overflow-x-hidden">
          <div className="px-6 py-8 md:px-10 md:py-10">
            
            <div className="mb-10">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-2">Your Itinerary</p>
              <h1 className="text-[34px] font-bold text-white tracking-tight leading-tight mb-2">{route.title}</h1>
              <p className="text-[15px] text-[#8e8e93]">
                {route.city} · {orderedWaypoints.length} stops across {dailyRoutes.length} {dailyRoutes.length === 1 ? "day" : "days"}
              </p>
            </div>
            
            <div className="mb-10 grid gap-3">
              <div className="rounded-[20px] bg-[#1c1c1e] p-5 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[#8e8e93] uppercase tracking-wider">Budget left</p>
                  <p className="mt-1 text-[24px] font-semibold text-white tracking-tight">{remainingBudget.toFixed(0)} <span className="text-[15px] font-medium text-[#8e8e93]">LEI</span></p>
                </div>
                <div className="text-right">
                   <div className="size-10 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                      <WalletCards size={18} className="text-[#8e8e93]" />
                   </div>
                </div>
              </div>

              {fatigueWarnings.some((warnings) => warnings.length > 0) && (
                <div className="rounded-[20px] bg-[#1c1c1e] p-5">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[#ff453a]">
                    <TriangleAlert size={16} /> High Fatigue Detected
                  </p>
                  <p className="mt-1 text-[14px] text-[#8e8e93] leading-snug">Multiple long walks detected. Consider adding a rest stop to your route.</p>
                </div>
              )}
            </div>

            <div className="relative">
              {dailyRoutes.map((dailyRoute, dayIndex) => (
                <div key={dailyRoute.day} className="mb-12 last:mb-0">
                  <h2 className="text-[20px] font-semibold text-white tracking-tight mb-6 flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ backgroundColor: routeColors[dayIndex % routeColors.length] }} />
                    Day {dailyRoute.day}
                  </h2>
                  
                  {/* Container for the timeline list */}
                  <div className="relative">
                    {/* The continuous vertical line */}
                    <div className="absolute left-[11px] top-[24px] bottom-[24px] w-[2px] bg-[#38383a]" />

                    {dailyRoute.waypoints.map((waypoint, index) => { 
                      const markerKey = `${dailyRoute.day}-${index}`; 
                      const parking = isParkingWaypoint(waypoint); 
                      const warning = fatigueWarnings[dayIndex].includes(index); 
                      
                      return (
                        <div key={markerKey} className="relative flex items-start mb-4 group">
                          
                          {/* Node (Number dot) - perfectly aligned with Flexbox */}
                          <div className="relative z-10 flex w-[24px] shrink-0 items-center justify-center pt-[18px]">
                            <div 
                              className="flex size-[24px] items-center justify-center rounded-full bg-[#1c1c1e] border-[2px]" 
                              style={{ borderColor: routeColors[dayIndex % routeColors.length] }}
                            >
                              <span className="text-[10px] font-bold text-white">{index + 1}</span>
                            </div>
                          </div>
                          
                          {/* Card Content */}
                          <div className="ml-4 flex-1">
                            <button 
                              type="button" 
                              onClick={() => focusStop(dailyRoute, index)} 
                              className={`w-full text-left rounded-2xl p-4 transition-colors duration-200 ${selectedStop === markerKey ? "bg-[#2c2c2e]" : "bg-[#1c1c1e] hover:bg-[#2c2c2e]"}`}
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                                {parking ? "P · Parking" : waypoint.category}
                              </p>
                              <h3 className="text-[17px] font-semibold text-white tracking-tight leading-snug">{waypoint.name}</h3>
                              
                              {waypoint.schedule_label && (
                                <p className="mt-1 text-[14px] font-medium text-[#e5e5ea]">{waypoint.schedule_label}</p>
                              )}
                              
                              <p className="mt-2 text-[13px] text-[#8e8e93]">
                                {waypoint.travel_minutes_from_previous ? `${waypoint.travel_minutes_from_previous} min travel` : "Starting point"}
                                {waypoint.transit_to_next ? ` · next: ${waypoint.transit_to_next.transit_mode} ${waypoint.transit_to_next.travel_duration_minutes} min` : ""}
                              </p>
                              
                              {warning && (
                                <span className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#ff9f0a]">
                                  <TriangleAlert size={14} /> Rest/Coffee break recommended
                                </span>
                              )}
                            </button>
                          </div>

                        </div>
                      ); 
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 border-t border-[#38383a] pt-6 text-[13px] text-[#8e8e93]">
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#8e8e93] hover:text-white transition-colors">
                Map data by OpenStreetMap <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </section>

        <section className="order-1 lg:order-2 relative bg-[#1c1c1e] w-full h-[50vh] lg:h-full border-b lg:border-b-0 border-[#38383a]">
          <div ref={mapElement} className="absolute inset-0 w-full h-full" />
          
          {isMapLoading && !mapError && (
            <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-md">
              <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-[#0a84ff] mb-4" size={32} />
                <p className="text-[15px] font-medium text-white">Loading map...</p>
              </div>
            </div>
          )}
          
          {mapError && (
            <div className="absolute inset-x-6 top-6 z-[500] rounded-2xl bg-[#2c1c19] p-4 text-[14px] text-[#ff6961] shadow-xl">
              {mapError}
            </div>
          )}
          
          <div className="absolute bottom-6 left-6 z-[400] flex flex-wrap items-center gap-3 rounded-[16px] bg-[#1c1c1e]/80 px-4 py-2.5 text-[13px] font-medium text-[#8e8e93] backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
            <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#0a84ff]" /> Stops</span>
            <span className="flex items-center gap-1.5 ml-2"><span className="flex size-[18px] items-center justify-center rounded-full bg-[#ff9f0a] text-[10px] font-bold text-white">P</span> Parking</span>
          </div>

          <div className="absolute bottom-6 right-6 z-[400] sm:hidden flex flex-col gap-3">
            <button type="button" onClick={saveCurrentRoute} disabled={saveState === "saving" || saveState === "saved"} className="flex items-center justify-center size-12 rounded-full bg-[#0a84ff] text-white shadow-lg disabled:opacity-60">
              <Save size={20} />
            </button>
            <a href={buildMapsUrl()} target="_blank" rel="noreferrer" className="flex items-center justify-center size-12 rounded-full bg-[#1c1c1e]/90 backdrop-blur-xl text-white shadow-lg border border-[#38383a]">
              <Map size={20} />
            </a>
          </div>
        </section>
        
      </div>
    </main>
  );
}