"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Compass, UserRound, Settings, LogOut } from 'lucide-react';
import RouteResults, { RouteData } from './RouteResults';
import TriplyLogo from '../shared/TriplyLogo';
import AdvancedRouteForm, { RouteFilters, defaultFilters } from './AdvancedRouteForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MinimalistBackground = () => (
  <div className="fixed inset-0 overflow-hidden bg-black pointer-events-none z-0">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1c1e_1px,transparent_1px),linear-gradient(to_bottom,#1c1c1e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_60%,transparent_100%)] opacity-30" />
  </div>
);

// Maps the frontend's pacing labels to the exact enum values the
// WayFinder-Agent microservice expects (see PacingLevel in schemas.py).
const pacingMap: Record<string, string> = {
  'Relaxed': 'Relaxed',
  'Balanced': 'Balanced',
  'Non-stop action': 'Intense',
};

export default function TravelDashboard() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLogoutPromptOpen, setIsLogoutPromptOpen] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState(false);
  
  const [filters, setFilters] = useState<RouteFilters>(defaultFilters);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<RouteData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('triply_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('triply_user');
      }
    }
  }, []);

  const confirmSignOut = () => {
      localStorage.removeItem('triply_token');
      localStorage.removeItem('triply_user');
      setUser(null);
      setIsLogoutPromptOpen(false);
      setIsSignedOut(true);
      window.setTimeout(() => setIsSignedOut(false), 1000);
    };

    const handleGenerate = async () => {
    if (!filters.city.trim()) {
      alert("Please set the city.");
      return;
    }
    if (!filters.startPoint.trim()) {
      alert("Please set a starting point.");
      return;
    }
    setIsGenerating(true);

    try {
      const token = localStorage.getItem("triply_token");

      const transportMap: Record<string, string> = {
        'walking': 'walking',
        'transit': 'public transport',
        'car': 'by car',
        'bike/scooter': 'walking',
        'rideshare': 'by car'
      };
      const backendTransport = transportMap[filters.mainTransport.toLowerCase()] || 'walking';

      const payload = {
        title: `${filters.city} Trip`,
        city: filters.city,
        cities: [filters.city],
        daily_plans: Array.from({ length: filters.days }).map((_, i) => ({
          day: i + 1,
          start: { name: filters.startPoint, latitude: 0, longitude: 0 },
          final_destination: { name: filters.isRoundTrip ? filters.startPoint : (filters.endPoint || filters.startPoint), latitude: 0, longitude: 0 }
        })),
        preferences: {
          transport: backendTransport,
          budget: filters.maxBudget,
          pacing: pacingMap[filters.pacing] || 'Balanced',
          categories: filters.categories,
          vibe: filters.vibe,
          hours_per_day: Math.max(1, (parseInt(filters.endTime) - parseInt(filters.startTime))),
          meals_per_day: filters.meals,
          accessibility_required: filters.accessibility,
          tourist_level: filters.touristLevel,
          free_only: filters.freeOnly,
          budget_allocation: filters.budgetAllocation,
          dining_style: filters.diningStyle,
          cuisine: filters.cuisine || null,
          dietary_restrictions: filters.dietaryRestrictions,
          weather_preference: filters.weatherPreference,
          group_type: filters.groupType,
          child_age: filters.childAge,
          pet_friendly: filters.petFriendly,
        }
      };

      const res = await fetch(`${API_URL}/api/v1/routes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token ?? ''}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401) window.location.assign("/auth");
        const details = await res.json().catch(() => null);
        throw new Error(details?.detail ?? "Failed to generate route.");
      }
      setGeneratedRoute(await res.json());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error generating route.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (generatedRoute) {
    return <RouteResults route={generatedRoute} onBack={() => setGeneratedRoute(null)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#0a84ff] selection:text-white pb-24">
      
      <AnimatePresence>
        {isLogoutPromptOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-[320px] bg-[#1c1c1e] rounded-[24px] p-6 text-center shadow-2xl">
              <h2 className="text-[20px] font-semibold text-white tracking-tight">Sign Out</h2>
              <p className="mt-2 text-[15px] text-[#aeaeb2] leading-snug">Are you sure you want to sign out of your account?</p>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={confirmSignOut} className="w-full py-3.5 bg-[#ff453a] text-white text-[17px] font-semibold rounded-xl hover:bg-[#ff5147] transition-colors">Sign Out</button>
                <button onClick={() => setIsLogoutPromptOpen(false)} className="w-full py-3.5 bg-[#2c2c2e] text-white text-[17px] font-semibold rounded-xl hover:bg-[#3a3a3c] transition-colors">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MinimalistBackground />

      <main className="relative z-10 max-w-[800px] mx-auto px-6 pt-8">
        <div className="fixed top-0 left-0 right-0 h-32 bg-black/50 backdrop-blur-3xl z-30 [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pointer-events-none" />
        
        {/* NAVBAR */}
        <header className="sticky top-6 z-40 mb-14 flex items-center justify-between rounded-full bg-[#1c1c1e]/70 px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl border border-white/5">
          <TriplyLogo />
          {user ? (
            <div className="relative">
              <button onClick={() => setIsAccountOpen(!isAccountOpen)} className="flex items-center gap-2 bg-[#2c2c2e] hover:bg-[#3a3a3c] transition-colors px-4 py-1.5 rounded-full text-[15px] font-medium text-white">
                <UserRound size={16} className="text-[#0a84ff]" /> <span className="max-w-[100px] truncate">{user.name}</span>
              </button>
              
              <AnimatePresence>
                {isAccountOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-12 z-50 w-60 rounded-2xl bg-[#2c2c2e]/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl border border-white/5"
                  >
                    <div className="px-3 py-2.5 border-b border-[#38383a]">
                      <p className="truncate text-[15px] font-semibold text-white tracking-tight">{user.name}</p>
                      <p className="truncate text-[13px] text-[#8e8e93] mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-1">
                      <Link href="/settings" className="flex items-center justify-between px-3 py-2 text-[15px] text-white hover:bg-[#0a84ff] hover:text-white rounded-xl transition-colors">
                        Settings
                        <Settings size={18} />
                      </Link>
                    </div>
                    <div className="border-t border-[#38383a] p-1">
                      <button onClick={() => { setIsAccountOpen(false); setIsLogoutPromptOpen(true); }} className="w-full flex items-center justify-between px-3 py-2 text-[15px] text-[#ff453a] hover:bg-[#ff453a] hover:text-white rounded-xl transition-colors">
                        Sign Out
                        <LogOut size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link href="/auth" className="text-[15px] font-medium text-[#0a84ff] hover:text-[#409cff] transition-colors px-2">Log In</Link>
          )}
        </header>

        {/* HERO SECTION */}
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#1c1c1e] border border-white/5 text-[13px] font-medium text-[#8e8e93]">
            <Compass size={14} className="text-[#0a84ff]" /> Plan your perfect day
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[44px] md:text-[56px] font-bold text-white leading-[1.05] tracking-tight mb-5">
            Make time for the <br className="hidden md:block"/> good parts.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-[19px] text-[#8e8e93] max-w-[500px] mx-auto leading-snug tracking-tight">
            Build a thoughtful day around the places you love. No clutter, just the perfect route.
          </motion.p>
        </div>

        {/* ROUTE PLANNER FORM */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <AdvancedRouteForm filters={filters} setFilters={setFilters} />
          
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating} 
            className="w-full mt-6 bg-[#0a84ff] hover:bg-[#0071e3] active:bg-[#005ecb] disabled:bg-[#2c2c2e] disabled:text-[#8e8e93] text-white text-[19px] font-semibold py-4 rounded-[18px] flex items-center justify-center gap-2 transition-colors duration-200 shadow-[0_4px_14px_rgba(10,132,255,0.3)]"
          >
            {isGenerating ? (
              <><Loader2 className="animate-spin" size={20} /> Building your route...</>
            ) : (
              <>Build My Day</>
            )}
          </button>
        </motion.div>

      </main>
    </div>
  );
}