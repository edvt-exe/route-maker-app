"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Navigation, Compass, Utensils, 
  Landmark, Footprints, Camera, Coffee, Route, 
  Map as MapIcon, Zap, ChevronRight, Loader2
} from 'lucide-react';

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
  { id: 'fine-dining', icon: Utensils, title: 'Fine Dining', category: 'Dining' },
  { id: 'cafes', icon: Coffee, title: 'Local Cafes', category: 'Dining' },
  { id: 'fast-pace', icon: Zap, title: 'Action Packed', category: 'Pacing' },
  { id: 'slow-pace', icon: Footprints, title: 'Leisurely Stroll', category: 'Pacing' },
];

export default function TravelDashboard() {
  const [activePrefs, setActivePrefs] = useState<string[]>([]);
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState<number>(3);
  const [hours, setHours] = useState<number>(8);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const togglePref = (id: string) => {
    setActivePrefs(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleGenerateRoute = async () => {
    if (!startLocation || !destination) {
      alert("Please enter both starting location and destination.");
      return;
    }

    setIsGenerating(true);

    const payload = {
      title: `${startLocation} to ${destination} Exploration`,
      city: destination, 
      waypoints: [
        {
          name: startLocation,
          category: "Start",
          latitude: 44.4268,
          longitude: 26.1025,
          order_index: 0
        },
        {
          name: destination,
          category: "Destination",
          latitude: 44.4379,
          longitude: 26.0955,
          order_index: 1
        }
      ]
    };

    try {
      const response = await fetch("http://localhost:8000/api/v1/routes/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer YOUR_JWT_TOKEN_HERE` 
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Triply route generated successfully:", data);
      alert("Your Triply route is ready.");
      
    } catch (error) {
      console.error("Failed to compute route matrix:", error);
      alert("We couldn't reach the route service. Check that the backend is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-200 font-sans relative overflow-x-hidden pb-20">
      <AnimatedMapBackground />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-sm font-medium mb-6 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Compass size={16} className="animate-spin-slow" />
            <span>Triply travel planner</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 text-white drop-shadow-lg">
            Make time for the good parts.
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            Tell us where you are starting, where you want to go, and what makes a day feel like yours.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-white">
                <Route className="text-cyan-400" /> Waypoints
              </h2>
              
              <div className="space-y-5 relative">
                <div className="absolute left-[1.1rem] top-10 bottom-10 w-0.5 bg-gradient-to-b from-cyan-500/50 to-amber-500/50 dashed" />
                
                <div className="relative group/input">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900 p-1 rounded-full z-10">
                    <Navigation size={18} className="text-cyan-400" />
                  </div>
                  <input 
                    type="text" 
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    placeholder="Where are you starting?" 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner" 
                  />
                </div>
                
                <div className="relative group/input">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900 p-1 rounded-full z-10">
                    <MapPin size={18} className="text-amber-400" />
                  </div>
                  <input 
                    type="text" 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where are you going?" 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-white">
                <Clock className="text-cyan-400" /> Temporal Constraints
              </h2>
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium uppercase tracking-wider">Days</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-16 pr-4 text-white text-right focus:outline-none focus:border-cyan-400 transition-all font-mono text-lg" 
                  />
                </div>
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium uppercase tracking-wider">Hrs</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="24" 
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-16 pr-4 text-white text-right focus:outline-none focus:border-cyan-400 transition-all font-mono text-lg" 
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-7 space-y-6 flex flex-col">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex-1">
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-xl font-semibold flex items-center gap-3 text-white">
                  <Zap className="text-cyan-400" /> What sounds good?
                </h2>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-full border border-cyan-500/20">
                  {activePrefs.length} chosen
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className={`cursor-pointer relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${isActive ? 'bg-cyan-900/30 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                      >
                        {isActive && <motion.div layoutId={`glow-${pref.id}`} className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
                        <div className="relative z-10 flex items-start gap-4">
                          <div className={`p-3 rounded-xl transition-colors ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                            <Icon size={20} />
                          </div>
                          <div>
                            <h3 className={`font-medium mb-1 transition-colors ${isActive ? 'text-white' : 'text-slate-300'}`}>{pref.title}</h3>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{pref.category}</p>
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
          </motion.div>
        </div>
      </main>
    </div>
  );
}