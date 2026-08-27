"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import RouteResults, { RouteData } from './RouteResults';
import TriplyLogo from '../shared/TriplyLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Compass, Utensils, 
  Landmark, Footprints, Camera, Coffee, Route, 
  Map as MapIcon, Zap, ChevronRight, Loader2, UserRound, Settings, LogOut, CheckCircle2, Sparkles, ArrowDown,
  TrainFront, Car, WalletCards, SunMedium, Heart, ArrowUpRight
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const AnimatedMapBackground = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="fixed inset-0 overflow-hidden bg-[#040814] pointer-events-none z-0" />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#040814] pointer-events-none z-0">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
      
      <svg className="absolute inset-0 w-full h-full opacity-40">
        <motion.path
          d="M-100,600 C200,500 300,700 600,300 S1000,500 1400,200"
          fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="10 10"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M1400,800 C1100,700 900,900 600,600 S200,700 -100,400"
          fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5 15"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`marker-${i}`}
          className="absolute text-cyan-500/30"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative">
            <MapIcon size={48} strokeWidth={1} />
            <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full" />
          </div>
        </motion.div>
      ))}
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
    </div>
  );
};

const PREFERENCES = [
  { id: 'landmarks', icon: Landmark, title: 'Historical Landmarks', category: 'Attractions' },
  { id: 'culture', icon: Camera, title: 'Arts & Culture', category: 'Attractions' },
  { id: 'parks', icon: Landmark, title: 'Parks & Gardens', category: 'Outdoors' },
  { id: 'viewpoints', icon: MapIcon, title: 'Viewpoints', category: 'Outdoors' },
  { id: 'fine-dining', icon: Utensils, title: 'Fine Dining', category: 'Dining' },
  { id: 'cafes', icon: Coffee, title: 'Local Cafes', category: 'Dining' },
  { id: 'fast-pace', icon: Zap, title: 'Action Packed', category: 'Pacing' },
  { id: 'slow-pace', icon: Footprints, title: 'Leisurely Stroll', category: 'Pacing' },
];

const TRANSPORT = [
  { id: 'walk', label: 'Mostly walking', icon: Footprints },
  { id: 'transit', label: 'Public transport', icon: TrainFront },
  { id: 'car', label: 'By car', icon: Car },
];

const QUICK_TRIPS = [
  { city: 'Lisbon', note: 'Hills, tiles & small plates', color: 'from-orange-200 to-rose-300' },
  { city: 'Copenhagen', note: 'Bikes, bakeries & design', color: 'from-sky-200 to-teal-300' },
  { city: 'Kyoto', note: 'Quiet lanes & old gardens', color: 'from-amber-100 to-red-200' },
];

type DailyPlan = { start: string; final: string };
type GeocodedPlace = { display_name: string; lat: string; lon: string };
type CityPoi = { name: string; city: string; category: string; latitude: number; longitude: number; cost: number; duration_minutes: number; rating: number; popularity_score: number; cuisine_types: string[]; wheelchair_accessible: boolean; tags: string[]; is_premium: boolean; required: boolean };

export default function TravelDashboard() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLogoutPromptOpen, setIsLogoutPromptOpen] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState(false);
  const [activePrefs, setActivePrefs] = useState<string[]>([]);
  const [cities, setCities] = useState("Bucharest");
  const [days, setDays] = useState<number>(1);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([
    { start: "", final: "" },
  ]);
  const [sameAccommodation, setSameAccommodation] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [mealsPerDay, setMealsPerDay] = useState<number>(1);
  const [diningBudget, setDiningBudget] = useState<number>(80);
  const [partySize, setPartySize] = useState<number>(2);
  const [cuisineTypes, setCuisineTypes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [budget, setBudget] = useState<number>(500);
  const [maxWalkingDistance, setMaxWalkingDistance] = useState<number>(5);
  const [accessibilityRequired, setAccessibilityRequired] = useState(false);
  const [transport, setTransport] = useState('walk');
  const [saved, setSaved] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<RouteData | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('triply_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('triply_user');
      }
    }
  }, []);

  const handleSignOut = () => {
    setIsLogoutPromptOpen(true);
    setIsAccountOpen(false);
  };

  const handleChangeAccount = () => {
    localStorage.removeItem('triply_token');
    localStorage.removeItem('triply_user');
    window.location.assign('/auth');
  };

  const confirmSignOut = () => {
    localStorage.removeItem('triply_token');
    localStorage.removeItem('triply_user');
    setUser(null);
    setIsLogoutPromptOpen(false);
    setIsSignedOut(true);
    window.setTimeout(() => setIsSignedOut(false), 1000);
  };
  
  const togglePref = (id: string) => {
    setActivePrefs(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const clearPreferences = () => setActivePrefs([]);
  const selectAllPreferences = () => setActivePrefs(PREFERENCES.map((preference) => preference.id));

  const scrollToPlanner = () => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const surprisePlan = () => {
    setCities("Bucharest");
    setTransport("walk");
    setActivePrefs(["landmarks", "culture", "parks"]);
    scrollToPlanner();
  };

  const updateDays = (value: number) => {
    const nextDays = Math.max(1, Math.min(14, value || 1));
    setDays(nextDays);
    setDailyPlans((currentPlans) => Array.from({ length: nextDays }, (_, index) => currentPlans[index] ?? { start: "", final: "" }));
  };

  const updateDailyPlan = (dayIndex: number, field: keyof DailyPlan, value: string) => {
    setDailyPlans((currentPlans) => currentPlans.map((plan, index) => index === dayIndex || (sameAccommodation && field === "final" && index > 0) ? { ...plan, [field]: value } : plan));
  };

  const toggleSameAccommodation = (enabled: boolean) => {
    setSameAccommodation(enabled);
    if (enabled) setDailyPlans((currentPlans) => currentPlans.map((plan, index) => index === 0 ? plan : { ...plan, final: currentPlans[0].final }));
  };

  const geocode = async (place: string, cityContext = ""): Promise<GeocodedPlace> => {
    const query = cityContext ? `${place}, ${cityContext}` : place;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { headers: { "Accept-Language": "en" } });
    if (!response.ok) throw new Error(`Could not search for ${place}.`);
    const results = await response.json() as GeocodedPlace[];
    if (!results[0]) throw new Error(`Could not find ${place}. Check the spelling or add more address detail.`);
    return results[0];
  };

  const discoverCityPois = async (city: string, place: GeocodedPlace): Promise<CityPoi[]> => {
    const query = `[out:json][timeout:20];(nwr(around:5000,${place.lat},${place.lon})["tourism"~"museum|gallery|attraction|viewpoint|zoo|theme_park"];nwr(around:5000,${place.lat},${place.lon})["historic"];nwr(around:5000,${place.lat},${place.lon})["amenity"~"cafe|restaurant"];nwr(around:5000,${place.lat},${place.lon})["leisure"="park"];);out center tags;`;
    const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
    let data: { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch {
        // Try the next public Overpass instance.
      }
    }
    const overpassPois = (data?.elements ?? []).flatMap((element) => {
      const tags = element.tags ?? {};
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      if (!tags.name || latitude === undefined || longitude === undefined) return [];
      const rawCategory = tags.amenity === "cafe" ? "Local Cafes" : tags.amenity === "restaurant" ? "Fine Dining" : tags.tourism === "museum" || tags.tourism === "gallery" ? "Arts & Culture" : tags.tourism === "viewpoint" ? "Viewpoints" : tags.leisure === "park" ? "Parks & Gardens" : "Historical Landmarks";
      const cost = rawCategory === "Fine Dining" ? 80 : rawCategory === "Local Cafes" ? 15 : rawCategory === "Arts & Culture" ? 20 : 0;
      return [{ name: tags.name, city, category: rawCategory, latitude, longitude, cost, duration_minutes: rawCategory === "Historical Landmarks" ? 45 : 60, rating: 0, popularity_score: 0, cuisine_types: tags.cuisine ? tags.cuisine.split(";").map((cuisine) => cuisine.trim()) : [], wheelchair_accessible: tags.wheelchair === "yes", tags: Object.values(tags), is_premium: false, required: false }];
    });
    if (overpassPois.length >= 10) return overpassPois.slice(0, 10);

    const fallbackQueries = ["landmark", "museum", "cafe", "park"];
    const fallbackPois: CityPoi[] = [];
    for (const category of fallbackQueries) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(`${category}, ${city}`)}`, { headers: { "Accept-Language": "en" } });
        if (!response.ok) continue;
        const results = await response.json() as Array<GeocodedPlace & { type?: string; name?: string }>;
        for (const result of results) {
          const name = result.name || result.display_name.split(",")[0];
          if (!name) continue;
          const rawCategory = category === "cafe" ? "Local Cafes" : category === "museum" ? "Arts & Culture" : category === "park" ? "Parks & Gardens" : "Historical Landmarks";
          fallbackPois.push({ name, city, category: rawCategory, latitude: Number(result.lat), longitude: Number(result.lon), cost: category === "cafe" ? 15 : category === "museum" ? 20 : 0, duration_minutes: 45, rating: 0, popularity_score: 0, cuisine_types: [], wheelchair_accessible: false, tags: [category], is_premium: false, required: false });
        }
      } catch {
        // Keep any places found by earlier providers.
      }
    }
    const combined = [...overpassPois, ...fallbackPois];
    return combined.filter((poi, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === poi.name.toLowerCase()) === index).slice(0, 10);
  };

  const handleGenerateRoute = async () => {
    const cityList = cities.split(",").map((city) => city.trim()).filter(Boolean);
    const startMinutes = Number(startTime.split(":")[0]) * 60 + Number(startTime.split(":")[1]);
    const endMinutes = Number(endTime.split(":")[0]) * 60 + Number(endTime.split(":")[1]);
    if (cityList.length === 0 || dailyPlans.some((plan) => !plan.start.trim() || !plan.final.trim()) || endMinutes <= startMinutes) {
      alert("Add the cities, valid daily start and final locations, and an end time after the start time.");
      return;
    }

    setIsGenerating(true);

    try {
      const waypoints: Array<{ name: string; category: string; latitude: number; longitude: number; order_index: number }> = [];
      const generatedDailyPlans = [];
      const pointsOfInterest: CityPoi[] = [];
      let orderIndex = 0;
      for (const city of cityList) {
        const location = await geocode(city);
        try {
          pointsOfInterest.push(...await discoverCityPois(city, location));
        } catch {
          // The route can still be built from its required daily anchors.
        }
      }
      for (const [dayIndex, plan] of dailyPlans.entries()) {
        const start = await geocode(plan.start);
        const final = await geocode(plan.final);
        generatedDailyPlans.push({ day: dayIndex + 1, start: { name: plan.start, latitude: Number(start.lat), longitude: Number(start.lon) }, final_destination: { name: plan.final, latitude: Number(final.lat), longitude: Number(final.lon) } });
        waypoints.push({ name: plan.start, category: `Day ${dayIndex + 1} · Start`, latitude: Number(start.lat), longitude: Number(start.lon), order_index: orderIndex++ });
        waypoints.push({ name: plan.final, category: `Day ${dayIndex + 1} · Final destination`, latitude: Number(final.lat), longitude: Number(final.lon), order_index: orderIndex++ });
      }
      const payload = {
        title: `${cityList.join(", ")} · ${days}-day route`,
        city: cityList.join(", "),
        waypoints,
        cities: cityList,
        daily_plans: generatedDailyPlans,
        points_of_interest: pointsOfInterest,
        preferences: {
          pacing_tags: activePrefs.map((preference) => preference === "fast-pace" ? "Action Packed" : preference === "slow-pace" ? "Leisurely Stroll" : preference),
          transport: transport === "walk" ? "walking" : transport === "transit" ? "public transport" : "by car",
          budget,
          categories: activePrefs.map((preference) => preference === "landmarks" ? "Historical Landmarks" : preference === "culture" ? "Arts & Culture" : preference === "parks" ? "Parks & Gardens" : preference === "viewpoints" ? "Viewpoints" : preference === "cafes" ? "Local Cafes" : preference === "fine-dining" ? "Fine Dining" : preference),
          hours_per_day: Math.max(1, (Number(endTime.split(":")[0]) * 60 + Number(endTime.split(":")[1]) - (Number(startTime.split(":")[0]) * 60 + Number(startTime.split(":")[1]))) / 60),
          start_time: startTime,
          end_time: endTime,
          meals_per_day: mealsPerDay,
          dining_budget: diningBudget,
          party_size: partySize,
          cuisine_types: cuisineTypes.split(",").map((cuisine) => cuisine.trim()).filter(Boolean),
          max_walking_distance_km: maxWalkingDistance,
          accessibility_required: accessibilityRequired,
          start_buffer_minutes: 60,
          end_buffer_minutes: 60,
        },
      };
      const token = localStorage.getItem("triply_token");
      if (!token?.trim()) {
        localStorage.removeItem("triply_user");
        window.location.assign("/auth");
        return;
      }
      const response = await fetch(`${API_URL}/api/v1/routes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token ?? ""}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("triply_token");
          localStorage.removeItem("triply_user");
          window.location.assign("/auth");
          return;
        }
        throw new Error(details?.detail ?? `API Error: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedRoute(data);
      
    } catch (error) {
      console.error("Failed to compute route matrix:", error);
      alert(error instanceof Error ? error.message : "We couldn't create this route.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (generatedRoute) {
    return <RouteResults route={generatedRoute} onBack={() => setGeneratedRoute(null)} />;
  }

  if (isGenerating) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#040814] px-6 text-slate-200">
        <AnimatedMapBackground />
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-2xl text-center"
          aria-live="polite"
        >
          <div className="relative mx-auto mb-10 grid size-40 place-items-center">
            <motion.div className="absolute inset-0 rounded-full border border-cyan-300/25" animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.2, 0.7, 0.2] }} transition={{ duration: 2.8, repeat: Infinity }} />
            <motion.div className="absolute inset-5 rounded-full border border-dashed border-amber-300/50" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
            <motion.div animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
              <Route size={48} className="text-cyan-300" strokeWidth={1.5} />
            </motion.div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Triply route lab</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">Finding the shape of your day.</h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
            We are connecting your starting point, the places worth lingering at, and the best way home into one thoughtful route.
          </p>
          <div className="mx-auto mt-10 flex max-w-sm items-center gap-3 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
            <motion.span className="h-px flex-1 bg-cyan-300/40" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span>Searching real places</span>
            <motion.span className="h-px flex-1 bg-amber-300/40" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          </div>
        </motion.section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-200 font-sans relative overflow-x-hidden pb-20">{isLogoutPromptOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 px-6 backdrop-blur-md"><motion.div role="dialog" aria-modal="true" aria-labelledby="logout-title" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950 p-7 text-center shadow-2xl"><motion.div initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring" }}><LogOut className="mx-auto text-amber-300" size={34} /></motion.div><h2 id="logout-title" className="mt-5 text-2xl font-semibold text-white">Are you sure you want to sign out?</h2><p className="mt-3 text-sm leading-6 text-slate-400">Your current session will be cleared from this device.</p><div className="mt-7 flex justify-center gap-3"><button type="button" onClick={() => setIsLogoutPromptOpen(false)} className="rounded-full border border-white/15 px-5 py-3 text-sm text-slate-300 transition-colors hover:border-white/35 hover:text-white">Stay signed in</button><button type="button" onClick={confirmSignOut} className="rounded-full bg-rose-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-rose-300">Sign out</button></div></motion.div></div>}{isSignedOut && <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/85 px-6 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.85, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="text-center"><CheckCircle2 className="mx-auto text-cyan-300" size={64} strokeWidth={1.5} /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Session ended</p><h2 className="mt-3 text-3xl font-semibold text-white">You're signed out.</h2></motion.div></div>}
      <AnimatedMapBackground />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12">
        <header className="sticky top-4 z-30 mb-12 flex items-center justify-between rounded-full border border-white/10 bg-slate-950/65 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-5">
          <TriplyLogo />
          <nav className="flex items-center gap-3 text-sm text-slate-400 sm:gap-6">
            <a href="#planner" className="hidden transition-colors hover:text-white sm:block">Plan a trip</a>
            <a href="#inspiration" className="hidden transition-colors hover:text-white sm:block">Inspiration</a>
            {user && <Link href="/routes/history" className="hidden transition-colors hover:text-white sm:block">My Routes</Link>}
            {user ? <div className="relative"><button type="button" onClick={() => setIsAccountOpen(!isAccountOpen)} className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-white transition-colors hover:border-cyan-300 hover:text-cyan-200 sm:px-4"><UserRound size={16} /><span className="max-w-32 truncate">{user.name}</span></button>{isAccountOpen && <div className="absolute right-0 top-14 z-20 w-72 rounded-3xl border border-white/15 bg-slate-950/95 p-5 text-left shadow-2xl backdrop-blur-xl"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Your account</p><div className="mt-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-cyan-300/15 text-cyan-200"><UserRound size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div></div><div className="my-5 border-t border-white/10" /><Link href="/settings" onClick={() => setIsAccountOpen(false)} className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"><Settings size={15} className="text-cyan-300" /> Account settings</Link><div className="mt-4 grid gap-2"><button type="button" onClick={handleChangeAccount} className="flex items-center gap-2 rounded-2xl border border-cyan-300/30 px-3 py-2.5 text-xs text-cyan-200 transition-colors hover:border-cyan-200 hover:bg-cyan-300/10"><UserRound size={14} /> Change account</button><button type="button" onClick={handleSignOut} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs text-slate-300 transition-colors hover:border-rose-300/50 hover:text-rose-200"><LogOut size={14} /> Sign out</button></div></div>}</div> : <Link href="/auth" className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-white transition-colors hover:border-cyan-300 hover:text-cyan-200 sm:px-4"><UserRound size={16} /> <span className="hidden sm:inline">Log in</span></Link>}
          </nav>
        </header>
        <motion.div initial="hidden" animate="visible" className="relative isolate mb-10 grid min-h-[19rem] items-center gap-8 overflow-hidden py-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div className="relative z-10 max-w-2xl">
            <motion.div variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }} className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/50 px-4 py-2 text-sm font-medium text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <Compass size={16} className="animate-spin-slow" />
              <span>Triply travel planner</span>
            </motion.div>
            <motion.p variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0, transition: { delay: 0.12, duration: 0.55 } } }} className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Plan less. Notice more.</motion.p>
            <motion.h1 variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { delay: 0.18, duration: 0.7 } } }} className="max-w-2xl text-5xl font-bold leading-[0.95] tracking-tight text-white drop-shadow-lg md:text-7xl">
              Make time for the good parts.
            </motion.h1>
            <motion.p variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.65 } } }} className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Build a day around the places that make a city feel alive, from the first coffee to the last beautiful turn home.
            </motion.p>
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { delay: 0.44, duration: 0.55 } } }} className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400"><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Real places</span><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Your pace</span><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">One good day</span></motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { delay: 0.56, duration: 0.55 } } }} className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={scrollToPlanner} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 hover:bg-cyan-200">Start planning <ArrowDown size={16} /></button><button type="button" onClick={surprisePlan} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-amber-300/60 hover:text-amber-200"><Sparkles size={16} /> Surprise me</button></motion.div>
          </div>
          <motion.div aria-hidden="true" className="relative mx-auto h-72 w-full max-w-md lg:h-96" variants={{ hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1, transition: { delay: 0.25, duration: 0.8 } } }}>
            <div className="absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20 bg-cyan-400/5 shadow-[0_0_90px_rgba(34,211,238,0.12)] lg:size-64" />
            <motion.div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-amber-300/25 lg:size-80" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute left-1/2 top-1/2 h-32 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-cyan-300/70" animate={{ rotate: [0, 8, 0, -8, 0], scale: [1, 1.04, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="absolute left-[18%] top-[32%] size-3 rounded-full bg-emerald-300 shadow-[0_0_18px_#6ee7b7]" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
            <motion.div className="absolute right-[16%] top-[22%] size-3 rounded-full bg-amber-300 shadow-[0_0_18px_#fcd34d]" animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 2.4, delay: 0.6, repeat: Infinity }} />
            <motion.div className="absolute bottom-[21%] right-[24%] size-3 rounded-full bg-cyan-300 shadow-[0_0_18px_#67e8f9]" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2.4, delay: 1.2, repeat: Infinity }} />
            <span className="absolute left-[8%] top-[25%] rounded-full border border-emerald-300/20 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">Start</span>
            <span className="absolute right-[2%] top-[14%] rounded-full border border-amber-300/20 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">Explore</span>
            <span className="absolute bottom-[12%] right-[10%] rounded-full border border-cyan-300/20 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Return</span>
            <motion.div className="absolute left-[19%] top-[33%] size-8 rounded-full border border-emerald-200/30" animate={{ scale: [1, 2.4], opacity: [0.7, 0] }} transition={{ duration: 2.4, repeat: Infinity }} />
          </motion.div>
        </motion.div>

        <div id="planner" className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6 lg:contents">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-3 text-white">
                <Route className="text-cyan-400" /> Build your route
              </h2>
              
              <div className="space-y-4 relative">
                
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">City or cities to visit
                  <input type="text" value={cities} onChange={(event) => setCities(event.target.value)} placeholder="Bucharest, Brasov" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                  <span className="mt-2 block text-xs font-normal normal-case tracking-normal text-slate-500">Separate multiple cities with commas.</span>
                </label>
                <div className="space-y-3">
                  {dailyPlans.map((plan, dayIndex) => <div key={dayIndex} className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Day {dayIndex + 1}</p>{sameAccommodation && dayIndex > 0 && <span className="text-[10px] uppercase tracking-wider text-slate-500">Same return</span>}</div><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs text-slate-400">Start from<input type="text" value={plan.start} onChange={(event) => updateDailyPlan(dayIndex, "start", event.target.value)} placeholder="Strada Cuza Voda 30" className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none" /></label><label className="block text-xs text-slate-400">Final destination<input type="text" value={plan.final} onChange={(event) => updateDailyPlan(dayIndex, "final", event.target.value)} placeholder="Accommodation or final stop" className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" /></label></div></div>)}
                </div>
                <label className="flex items-center gap-3 text-xs text-slate-300"><input type="checkbox" checked={sameAccommodation} onChange={(event) => toggleSameAccommodation(event.target.checked)} className="size-4 accent-cyan-400" /> Return to the same accommodation every day</label>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-white">
                <Clock className="text-cyan-400" /> Temporal Constraints
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Days<input type="number" min="1" max="14" value={days} onChange={(event) => updateDays(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-4 text-center text-lg text-white focus:border-cyan-400 focus:outline-none" /></label>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-4 text-center text-lg text-white focus:border-cyan-400 focus:outline-none" /></label>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-4 text-center text-lg text-white focus:border-cyan-400 focus:outline-none" /></label>
              </div>
              <div className="mt-5 border-t border-white/10 pt-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Meals per day</label>
                <div className="mt-2 flex items-center gap-3"><button type="button" aria-label="Fewer meals" onClick={() => setMealsPerDay((value) => Math.max(0, value - 1))} className="grid size-10 place-items-center rounded-full border border-white/15 text-lg text-white hover:border-cyan-300">-</button><span className="min-w-10 text-center text-lg font-semibold text-white">{mealsPerDay}</span><button type="button" aria-label="More meals" onClick={() => setMealsPerDay((value) => Math.min(4, value + 1))} className="grid size-10 place-items-center rounded-full border border-white/15 text-lg text-white hover:border-cyan-300">+</button><span className="text-xs text-slate-500">One hour is reserved before and after each day.</span></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dining budget total<input type="number" min="0" step="1" value={diningBudget} onChange={(event) => setDiningBudget(Math.max(0, Number(event.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none" /></label><label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Party size<input type="number" min="1" max="50" step="1" value={partySize} onChange={(event) => setPartySize(Math.max(1, Math.min(50, Number(event.target.value))))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none" /></label></div>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-400">Cuisine types<span className="mt-2 block text-[11px] font-normal normal-case tracking-normal text-slate-500">Comma-separated, for example Italian, Japanese</span><input type="text" value={cuisineTypes} onChange={(event) => setCuisineTypes(event.target.value)} placeholder="Italian, Japanese" className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none" /></label>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.13),transparent_48%),rgba(15,23,42,0.72)] p-6 shadow-2xl backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full border border-amber-300/15" />
              <h2 className="relative mb-2 flex items-center gap-3 text-lg font-semibold text-white"><WalletCards className="text-amber-300" /> Shape the day</h2>
              <p className="mb-5 text-sm text-slate-400">Tune the rhythm, movement, and spend before Triply builds your route.</p>
              <div className="mb-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider"><span className="rounded-full bg-amber-300/10 px-3 py-1.5 text-amber-200">{budget} LEI</span><span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-cyan-200">{transport === 'walk' ? 'Walking' : transport === 'transit' ? 'Transit' : 'Car'}</span></div>
              <label className="mb-3 mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Getting around</label>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORT.map(({ id, label, icon: Icon }) => <button type="button" key={id} title={label} onClick={() => setTransport(id)} className={`grid place-items-center gap-1.5 rounded-2xl border p-2.5 text-[11px] transition-all ${transport === id ? 'border-cyan-300 bg-cyan-300/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]' : 'border-white/10 text-slate-500 hover:border-white/30 hover:text-white'}`}><Icon size={17} />{label.replace('Mostly ', '')}</button>)}
              </div>
              <label className="mb-3 mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Exact budget (LEI)</label>
              <div className="relative"><input type="number" min="0" step="1" value={budget} onChange={(event) => setBudget(Math.max(0, Number(event.target.value)))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 pr-16 text-white outline-none transition-shadow focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-300">LEI</span></div>
              <div className="mt-5 border-t border-white/10 pt-5"><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Max walking distance <span className="float-right text-cyan-300">{maxWalkingDistance} km</span></label><input type="range" min="1" max="30" step="1" value={maxWalkingDistance} onChange={(event) => setMaxWalkingDistance(Number(event.target.value))} className="mt-4 w-full accent-cyan-300" /><div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>1 km</span><span>30 km</span></div></div>
              <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300"><span><span className="block font-semibold text-white">Wheelchair / stroller access</span><span className="mt-1 block text-slate-500">Prefer accessible destinations</span></span><input type="checkbox" checked={accessibilityRequired} onChange={(event) => setAccessibilityRequired(event.target.checked)} className="size-5 accent-cyan-300" /></label>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="flex flex-col space-y-6 lg:contents">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
              <div className="flex justify-between items-end mb-5">
                <h2 className="text-lg font-semibold flex items-center gap-3 text-white">
                  <Zap className="text-cyan-400" /> What sounds good?
                </h2>
                <div className="flex items-center gap-3"><span className="text-xs font-mono text-cyan-400">{activePrefs.length} chosen</span>{activePrefs.length < PREFERENCES.length && <button type="button" onClick={selectAllPreferences} className="text-xs text-slate-500 transition-colors hover:text-white">All</button>}{activePrefs.length > 0 && <button type="button" onClick={clearPreferences} className="text-xs text-slate-500 transition-colors hover:text-white">Clear</button>}</div>
              </div>
              <p className="mb-5 text-sm text-slate-400">Pick the ingredients for your day. Triply will balance them with your time and pace.</p>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <AnimatePresence>
                  {PREFERENCES.map((pref, index) => {
                    const isActive = activePrefs.includes(pref.id);
                    const Icon = pref.icon;
                    return (
                      <motion.div
                        key={pref.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * index }}
                        onClick={() => togglePref(pref.id)}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className={`cursor-pointer relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 ${isActive ? 'bg-cyan-900/30 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                      >
                        {isActive && <motion.div layoutId={`glow-${pref.id}`} className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
                        <div className="relative z-10 flex items-center gap-2.5">
                          <div className={`rounded-xl p-2 transition-colors ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <h3 className={`truncate text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-300'}`}>{pref.title}</h3>
                            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">{pref.category}</p>
                          </div>
                        </div>
                        <div className={`absolute top-4 right-4 w-2 h-2 rounded-full transition-colors duration-300 ${isActive ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-800'}`} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <motion.button
              onClick={handleGenerateRoute}
              disabled={isGenerating}
              whileHover={!isGenerating ? { scale: 1.02, textShadow: "0px 0px 8px rgb(255,255,255)" } : {}} 
              whileTap={!isGenerating ? { scale: 0.98 } : {}}
              className={`w-full relative group overflow-hidden rounded-3xl p-[2px] ${isGenerating ? 'opacity-80 cursor-not-allowed' : ''} bg-gradient-to-r from-cyan-500 to-blue-600`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
              <div className="relative bg-slate-950 px-8 py-6 rounded-[22px] flex items-center justify-between transition-all duration-300 group-hover:bg-opacity-0">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-2 rounded-full">
                    {isGenerating ? <Loader2 className="text-white animate-spin" /> : <Route className="text-white" />}
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-white">
                    {isGenerating ? "Putting your day together..." : "Build my day"}
                  </span>
                </div>
                <div className="bg-white/10 rounded-full p-2 group-hover:translate-x-2 transition-transform duration-300">
                  <ChevronRight className="text-white" />
                </div>
              </div>
            </motion.button>
            <button type="button" onClick={() => setSaved(!saved)} className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400 transition-colors hover:text-white"><Heart size={16} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-300' : ''} /> {saved ? 'Trip idea saved' : 'Save this trip idea'}</button>
          </motion.div>
        </div>

        <section id="inspiration" className="mt-20 border-t border-white/10 pt-9">
          <div className="mb-6 flex items-end justify-between"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">A little inspiration</p><h2 className="text-3xl font-semibold text-white">Start with a feeling.</h2></div><SunMedium className="text-amber-300" size={28} /></div>
          <div className="grid gap-4 md:grid-cols-3">
            {QUICK_TRIPS.map((trip, index) => <motion.button type="button" key={trip.city} onClick={() => { setCities(trip.city); scrollToPlanner(); }} whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} className={`group relative min-h-44 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 p-6 text-left text-white shadow-xl backdrop-blur-xl ${index === 0 ? 'hover:border-orange-300/60' : index === 1 ? 'hover:border-cyan-300/60' : 'hover:border-amber-300/60'}`}><div className={`absolute -right-8 -top-10 text-[9rem] font-black leading-none opacity-10 ${index === 0 ? 'text-orange-300' : index === 1 ? 'text-cyan-300' : 'text-amber-300'}`}>{trip.city[0]}</div><div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" /><ArrowUpRight className="absolute right-5 top-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white" size={20} /><div className="relative mt-16"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick route {index + 1}</p><h3 className="text-2xl font-semibold">{trip.city}</h3><p className="mt-1 text-sm text-slate-400">{trip.note}</p></div></motion.button>)}
          </div>
        </section>
      </main>
    </div>
  );
}