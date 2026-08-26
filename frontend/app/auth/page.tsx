"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import AnimatedMap from "../components/shared/AnimatedMap";
import TriplyLogo from "../components/shared/TriplyLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuthPage() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password") }) });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Email or password is not recognised.");
      }
      const data = await response.json();
      if (!data.access_token || !data.user) throw new Error("The login response was incomplete.");
      localStorage.setItem("triply_token", data.access_token);
      localStorage.setItem("triply_user", JSON.stringify(data.user));
      setIsSuccess(true);
      window.setTimeout(() => window.location.assign("/"), 1100);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in right now.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07110f] text-[#dce8df]"><AnimatedMap />{isSuccess && <div className="fixed inset-0 z-30 grid place-items-center bg-[#07110f]/90 px-6 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.85, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="text-center"><motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15, duration: 0.5, type: "spring" }}><CheckCircle2 className="mx-auto text-[#6fae91]" size={64} strokeWidth={1.5} /></motion.div><p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-[#f08a68]">Access confirmed</p><h2 className="mt-3 text-3xl font-semibold text-white">Welcome back.</h2><p className="mt-3 text-[#a9bbb0]">Opening your planner...</p></motion.div></div>}<div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7 lg:px-10">
      <header className="flex items-center justify-between border-b border-[#dce8df]/15 pb-5"><TriplyLogo /><Link href="/" className="text-sm text-[#9ac7ac] hover:text-[#f08a68]">Back to planner</Link></header>
      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1fr_410px] lg:gap-24"><motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="max-w-xl"><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.5 }} className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#f08a68]"><span className="h-px w-10 bg-[#f08a68]" />Return to your map</motion.p><h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl">Your next good day is waiting.</h1><motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="mt-7 max-w-md text-lg leading-8 text-[#a9bbb0]">Save the places you love, pick up unfinished plans, and keep your weekends feeling like yours.</motion.p></motion.div>
        <form onSubmit={handleSubmit} className="border border-[#dce8df]/15 bg-[#0d211c]/90 p-7 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f08a68]">Member access</p><h2 className="mt-3 text-3xl font-semibold">Welcome back.</h2><div className="mt-8 space-y-5"><label className="block text-sm text-[#a9bbb0]">Email or name<span className="relative mt-2 block"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#719184]" size={18} /><input name="identifier" required minLength={2} placeholder="you@example.com or Alex" className="w-full border border-[#dce8df]/15 bg-[#07110f]/80 py-3.5 pl-12 pr-4 outline-none placeholder:text-[#719184] focus:border-[#f08a68]" /></span></label><label className="block text-sm text-[#a9bbb0]">Password<span className="relative mt-2 block"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#719184]" size={18} /><input name="password" required type="password" placeholder="Your password" className="w-full border border-[#dce8df]/15 bg-[#07110f]/80 py-3.5 pl-12 pr-4 outline-none placeholder:text-[#719184] focus:border-[#f08a68]" /></span></label></div>{error && <p role="alert" className="mt-4 text-sm text-[#ff9d82]">{error}</p>}<button disabled={isSubmitting} type="submit" className="mt-8 flex w-full items-center justify-between bg-[#f08a68] px-5 py-4 font-semibold text-[#07110f] transition-colors hover:bg-[#ffb092] disabled:opacity-60">{isSubmitting ? "Signing in..." : "Continue exploring"}<ArrowRight size={19} /></button><p className="mt-6 text-center text-sm text-[#719184]">New to Triply? <Link href="/signup" className="font-semibold text-[#9ac7ac] hover:text-[#f08a68]">Create an account</Link></p></form>
      </section>
    </div></main>
  );
}
