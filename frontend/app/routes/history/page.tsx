"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, MapPinned, Clock3 } from "lucide-react";
import { loadSavedRoutes, type SavedRouteRecord } from "../../lib/savedRoutes";
import RouteResults, { type RouteData } from "../../components/ui/RouteResults";

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function SavedRoutesHistoryPage() {
  const [routes, setRoutes] = useState<SavedRouteRecord[]>(() => loadSavedRoutes());
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = () => setRoutes(loadSavedRoutes());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (selectedRoute) {
    return (
      <RouteResults
        route={selectedRoute}
        onBack={() => setSelectedRoute(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#0a84ff] selection:text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="relative flex items-center justify-center mb-8">
          <Link
            href="/"
            className="absolute left-0 flex items-center gap-1 text-[17px] text-[#0a84ff] hover:text-[#409cff] transition-colors"
          >
            <ChevronLeft size={24} className="-ml-2" />
            <span>Back</span>
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight text-white">Saved Routes</h1>
        </header>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {routes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#2c2c2e] bg-[#101112] p-8 text-center">
              <p className="text-[20px] font-semibold text-white">No saved routes yet</p>
              <p className="mt-2 text-[15px] text-[#8e8e93]">Generate a route and it will appear here for quick access.</p>
              <Link href="/" className="mt-5 inline-flex items-center rounded-full bg-[#0a84ff] px-4 py-2 text-[15px] font-medium text-white">
                Build a route
              </Link>
            </div>
          ) : (
            routes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedRoute(entry.route)}
                className="group w-full rounded-3xl border border-white/5 bg-[#1c1c1e] p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 hover:border-[#0a84ff]/60 hover:bg-[#212225]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[22px] font-semibold text-white tracking-tight">{entry.title}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-[#8e8e93]">
                      <span className="flex items-center gap-1.5">
                        <MapPinned size={14} /> {entry.city}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={14} /> {formatSavedDate(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#0a84ff]/15 px-3 py-1 text-[12px] font-semibold text-[#7cc0ff]">
                    Open
                  </span>
                </div>
              </button>
            ))
          )}
        </motion.div>
      </div>
    </main>
  );
}
