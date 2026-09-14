"use client";

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, MapPin, Clock, Wallet, Car, Navigation } from 'lucide-react';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false });


export interface TransitDetails {
  transit_mode: string;
  travel_duration_minutes: number;
}

export interface WaypointSchema {
  id?: number | null;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  order_index: number;
  arrival_time?: string | null;
  departure_time?: string | null;
  schedule_label?: string | null;
  transit_to_next?: TransitDetails | null;
  estimated_cost?: number | null;
  travel_minutes_from_previous?: number | null;
}

export interface DailyItinerarySchema {
  day: number;
  start: WaypointSchema;
  stops: WaypointSchema[];
  final_destination: WaypointSchema;
}

export interface RouteData {
  title: string;
  city: string;
  waypoints: WaypointSchema[];
  itineraries: DailyItinerarySchema[];
  navigation_url?: string | null;
  initial_budget?: number | null;
}

interface RouteResultsProps {
  route: RouteData;
  onBack: () => void;
}

const CATEGORY_ICON: Record<string, string> = {
  start_point: '🏁',
  end_point: '🏁',
  parking: '🅿️',
  restaurant: '🍽️',
  cafe: '☕',
  park: '🌳',
  museum: '🏛️',
  attraction: '📍',
};

function iconFor(category: string) {
  return CATEGORY_ICON[category] ?? '📍';
}

function buildGoogleMapsUrl(dayStops: WaypointSchema[]): string {
  const valid = dayStops.filter(s => s.latitude !== 0 && s.longitude !== 0);
  if (valid.length < 2) return '';

  const origin = `${valid[0].latitude},${valid[0].longitude}`;
  const destination = `${valid[valid.length - 1].latitude},${valid[valid.length - 1].longitude}`;
  const waypoints = valid
    .slice(1, -1)
    .map(s => `${s.latitude},${s.longitude}`)
    .join('|');

  const params = new URLSearchParams({ api: '1', origin, destination });
  if (waypoints) params.set('waypoints', waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function RouteResults({ route, onBack }: RouteResultsProps) {
  const [selectedDay, setSelectedDay] = useState(1);

  const currentItinerary = useMemo(
    () => route.itineraries.find(it => it.day === selectedDay) ?? route.itineraries[0],
    [route.itineraries, selectedDay]
  );

  const dayWaypoints: WaypointSchema[] = useMemo(() => {
    if (!currentItinerary) return [];
    return [currentItinerary.start, ...currentItinerary.stops, currentItinerary.final_destination];
  }, [currentItinerary]);

  const dayCost = useMemo(
    () => dayWaypoints.reduce((sum, wp) => sum + (wp.estimated_cost ?? 0), 0),
    [dayWaypoints]
  );

  const handleExportPdf = () => {
    window.print();
  };

  const handleGoogleMaps = () => {
    const url = buildGoogleMapsUrl(dayWaypoints);
    if (!url) {
      alert("Not enough valid stops to build a Google Maps route for this day.");
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Top action bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-6 py-4 bg-black/80 backdrop-blur-xl border-b border-white/5 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[15px] text-[#aeaeb2] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h1 className="text-[17px] font-semibold tracking-tight truncate">{route.title}</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[14px] font-medium transition-colors"
          >
            <Download size={16} /> Export PDF
          </button>
          <button
            onClick={handleGoogleMaps}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0a84ff] hover:bg-[#0071e3] text-[14px] font-medium transition-colors"
          >
            <Navigation size={16} /> Google Maps
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 py-6 max-w-[1400px] mx-auto">
        {/* LEFT: itinerary */}
        <div className="space-y-4 print:col-span-2">
          {/* Day selector tabs */}
          {route.itineraries.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
              {route.itineraries.map(it => (
                <button
                  key={it.day}
                  onClick={() => setSelectedDay(it.day)}
                  className={`relative px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${
                    selectedDay === it.day ? 'text-white' : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  {selectedDay === it.day && (
                    <motion.div
                      layoutId="day-pill"
                      className="absolute inset-0 bg-[#0a84ff] rounded-full"
                      transition={{ type: 'spring', duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">Day {it.day}</span>
                </button>
              ))}
            </div>
          )}

          {/* Day summary */}
          <div className="flex items-center gap-4 text-[13px] text-[#8e8e93] px-1">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {dayWaypoints.length} stops
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet size={14} /> €{dayCost.toFixed(2)} today
            </span>
          </div>

          {/* Itinerary cards for the selected day only */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDay}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {dayWaypoints.map((wp, i) => (
                <div key={wp.id ?? i} className="flex items-start gap-3 bg-[#1c1c1e] rounded-2xl p-4">
                  <div className="w-9 h-9 rounded-full bg-[#2c2c2e] flex items-center justify-center text-[16px] shrink-0">
                    {iconFor(wp.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-white truncate">{wp.name}</p>
                      {wp.estimated_cost !== null && wp.estimated_cost !== undefined && wp.estimated_cost > 0 && (
                        <span className="text-[13px] font-medium text-[#0a84ff] shrink-0">
                          €{wp.estimated_cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#8e8e93] mt-0.5">
                      {wp.schedule_label || wp.category}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-[#636366]">
                      {wp.arrival_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {wp.arrival_time}
                        </span>
                      )}
                      {wp.travel_minutes_from_previous ? (
                        <span className="flex items-center gap-1">
                          <Car size={11} /> {wp.travel_minutes_from_previous} min
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT: sticky interactive map */}
        <div className="print:hidden">
          <div className="sticky top-[88px] h-[calc(100vh-104px)] rounded-2xl overflow-hidden border border-white/5">
            <RouteMap waypoints={dayWaypoints} />
          </div>
        </div>
      </main>

      {/* Print-only styles: hide interactive chrome, keep the itinerary clean */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}