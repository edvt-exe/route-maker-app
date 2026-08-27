"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, MapPinned, Route as RouteIcon } from "lucide-react";
import RouteResults, { RouteData } from "../../components/ui/RouteResults";
import TriplyLogo from "../../components/shared/TriplyLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SavedRoute = {
  id: number;
  title: string;
  city: string;
  created_at: string;
  payload: RouteData;
};

export default function RouteHistoryPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("triply_token");
    if (!token) {
      window.location.assign("/auth");
      return;
    }
    fetch(`${API_URL}/api/v1/routes/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load your saved routes.");
        return response.json() as Promise<SavedRoute[]>;
      })
      .then(setRoutes)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load your saved routes."))
      .finally(() => setIsLoading(false));
  }, []);

  if (selectedRoute) {
    return <RouteResults route={selectedRoute} onBack={() => setSelectedRoute(null)} />;
  }

  return (
    <main className="min-h-screen bg-[#040814] px-6 py-7 text-slate-200 lg:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 pb-5">
        <TriplyLogo />
        <Link href="/" className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-cyan-200"><ArrowLeft size={16} /> Plan a route</Link>
      </header>
      <section className="mx-auto max-w-6xl py-12">
        <div className="mb-10 flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your library</p><h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">My Routes</h1><p className="mt-4 max-w-xl text-slate-400">Your saved days, preserved exactly as planned.</p></div><RouteIcon className="hidden text-cyan-300 sm:block" size={34} /></div>
        {isLoading && <div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="animate-spin text-cyan-300" size={18} />Loading your routes...</div>}
        {error && <p role="alert" className="border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">{error}</p>}
        {!isLoading && !error && routes.length === 0 && <div className="border border-dashed border-white/15 bg-slate-900/50 p-10 text-center"><MapPinned className="mx-auto text-cyan-300" size={30} /><h2 className="mt-4 text-xl font-semibold text-white">No saved routes yet</h2><p className="mt-2 text-sm text-slate-400">Build a route and use Save route to keep it here.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Start planning</Link></div>}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{routes.map((route) => <button type="button" key={route.id} onClick={() => setSelectedRoute(route.payload)} className="group rounded-3xl border border-white/10 bg-slate-900/65 p-6 text-left shadow-xl backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-cyan-300/50 hover:bg-slate-900/85"><div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-cyan-300"><span>{route.city}</span><CalendarDays size={16} /></div><h2 className="mt-8 text-2xl font-semibold text-white group-hover:text-cyan-100">{route.title}</h2><p className="mt-4 text-sm text-slate-500">Saved {new Date(route.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p><span className="mt-8 block text-sm font-semibold text-amber-300">Open itinerary →</span></button>)}</div>
      </section>
    </main>
  );
}
