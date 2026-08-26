"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bell, Check, ChevronLeft, Clock3, Eye, LockKeyhole, LogOut, Map, Moon, Save, SlidersHorizontal, UserRound } from "lucide-react";
import TriplyLogo from "../components/shared/TriplyLogo";

type Account = { name: string; email: string };
type ToggleProps = { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; icon: typeof Bell };

function Toggle({ label, description, checked, onChange, icon: Icon }: ToggleProps) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-white/10 py-4 last:border-0"><span className="flex min-w-0 items-start gap-3"><Icon size={18} className="mt-0.5 shrink-0 text-cyan-300" /><span><span className="block text-sm font-medium text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span></span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 shrink-0 accent-cyan-300" /></label>;
}

export default function SettingsPage() {
  const [account, setAccount] = useState<Account>({ name: "", email: "" });
  const [saved, setSaved] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [meals, setMeals] = useState(1);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [routeReminders, setRouteReminders] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [privateRoutes, setPrivateRoutes] = useState(true);

  useEffect(() => {
    const storedAccount = localStorage.getItem("triply_user");
    if (storedAccount) {
      try { setAccount(JSON.parse(storedAccount)); } catch { localStorage.removeItem("triply_user"); }
    }
    const storedPreferences = localStorage.getItem("triply_preferences");
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        setStartTime(preferences.startTime ?? "09:00");
        setEndTime(preferences.endTime ?? "17:00");
        setMeals(preferences.meals ?? 1);
        setEmailUpdates(preferences.emailUpdates ?? true);
        setRouteReminders(preferences.routeReminders ?? true);
        setReducedMotion(preferences.reducedMotion ?? false);
        setPrivateRoutes(preferences.privateRoutes ?? true);
      } catch { localStorage.removeItem("triply_preferences"); }
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem("triply_user", JSON.stringify(account));
    localStorage.setItem("triply_preferences", JSON.stringify({ startTime, endTime, meals, emailUpdates, routeReminders, reducedMotion, privateRoutes }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const signOut = () => {
    localStorage.removeItem("triply_token");
    localStorage.removeItem("triply_user");
    window.location.assign("/auth");
  };

  return <main className="min-h-screen bg-[#040814] text-slate-200"><div className="mx-auto max-w-5xl px-6 py-7 lg:px-10"><header className="flex items-center justify-between rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 shadow-2xl backdrop-blur-xl sm:px-5"><TriplyLogo /><Link href="/" className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"><ChevronLeft size={16} /> Back to planner</Link></header><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="py-12"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Your space</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Account settings</h1><p className="mt-4 max-w-xl text-slate-400">Shape how Triply plans, remembers, and keeps your days moving.</p></motion.div><div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><section className="space-y-5"><div className="rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-xl backdrop-blur-xl"><div className="mb-5 flex items-center gap-3"><UserRound className="text-cyan-300" size={20} /><div><h2 className="font-semibold text-white">Profile</h2><p className="text-xs text-slate-400">The name shown in your planner.</p></div></div><label className="block text-sm text-slate-300">Display name<input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-300" /></label><label className="mt-4 block text-sm text-slate-300">Email address<input value={account.email} readOnly className="mt-2 w-full rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-slate-500 outline-none" /></label></div><div className="rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-xl backdrop-blur-xl"><div className="mb-5 flex items-center gap-3"><Clock3 className="text-amber-300" size={20} /><div><h2 className="font-semibold text-white">Planning defaults</h2><p className="text-xs text-slate-400">Used when you start a new route.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Day starts<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300" /></label><label className="text-sm text-slate-300">Day ends<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300" /></label></div><label className="mt-5 block text-sm text-slate-300">Meals per day<div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => setMeals(Math.max(0, meals - 1))} className="grid size-10 place-items-center rounded-full border border-white/15 text-lg hover:border-cyan-300">-</button><span className="min-w-8 text-center font-semibold text-white">{meals}</span><button type="button" onClick={() => setMeals(Math.min(4, meals + 1))} className="grid size-10 place-items-center rounded-full border border-white/15 text-lg hover:border-cyan-300">+</button></div></label></div></section><aside className="space-y-5"><div className="rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-xl backdrop-blur-xl"><div className="mb-2 flex items-center gap-3"><SlidersHorizontal className="text-cyan-300" size={20} /><h2 className="font-semibold text-white">Preferences</h2></div><Toggle label="Trip updates" description="Receive occasional planning ideas." checked={emailUpdates} onChange={setEmailUpdates} icon={Bell} /><Toggle label="Route reminders" description="Keep upcoming plans visible." checked={routeReminders} onChange={setRouteReminders} icon={Map} /><Toggle label="Reduce motion" description="Use calmer page transitions." checked={reducedMotion} onChange={setReducedMotion} icon={Eye} /><Toggle label="Private routes" description="Keep saved routes visible only to you." checked={privateRoutes} onChange={setPrivateRoutes} icon={LockKeyhole} /><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Moon size={14} /> Dark appearance is active</div></div><div className="rounded-3xl border border-rose-300/15 bg-rose-950/20 p-6"><h2 className="font-semibold text-white">Session</h2><p className="mt-2 text-xs leading-5 text-slate-400">Sign out on this device and return to the login screen.</p><button type="button" onClick={signOut} className="mt-4 flex items-center gap-2 rounded-full border border-rose-300/30 px-4 py-2.5 text-sm text-rose-200 transition-colors hover:bg-rose-300/10"><LogOut size={15} /> Sign out</button></div></aside></div><div className="sticky bottom-5 mt-8 flex justify-end"><button type="button" onClick={saveSettings} className="flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_8px_30px_rgba(34,211,238,0.2)] transition-transform hover:-translate-y-0.5">{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "Saved" : "Save changes"}</button></div></div></main>;
}
