"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, LockKeyhole, UserRound, X } from "lucide-react";
import AnimatedMap from "../components/shared/AnimatedMap";
import TriplyLogo from "../components/shared/TriplyLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const rules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "A letter", test: (value: string) => /[a-z]/i.test(value) },
  { label: "A capital letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function SignupPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const confirmation = String(form.get("confirmation") ?? "");
    if (name.length < 2) return setError("Please enter a name with at least 2 characters.");
    if (!rules.every((rule) => rule.test(password))) return setError("Please meet every password requirement.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      if (response.status === 409) throw new Error("That name or email is already in use.");
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "We could not create your account.");
      }
      const data = await response.json();
      if (!data.challenge_id || !data.user) throw new Error("The registration response was incomplete.");
      setChallengeId(data.challenge_id);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? `Cannot reach the backend at ${API_URL}. Start FastAPI on port 8000 and try again.` : requestError instanceof Error ? requestError.message : "Unable to create your account right now.");
    } finally { setIsSubmitting(false); }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/verify-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge_id: challengeId, code: otp }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail ?? "That verification code is not valid.");
      if (!data.access_token || !data.user) throw new Error("The verification response was incomplete.");
      localStorage.setItem("triply_token", data.access_token);
      localStorage.setItem("triply_user", JSON.stringify(data.user));
      setIsSuccess(true);
      window.setTimeout(() => window.location.assign("/"), 1100);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? `Cannot reach the backend at ${API_URL}. Start FastAPI on port 8000 and try again.` : requestError instanceof Error ? requestError.message : "Unable to verify your code right now.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07110f] text-[#dce8df]"><AnimatedMap />{isSuccess && <div className="fixed inset-0 z-30 grid place-items-center bg-[#07110f]/90 px-6 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.85, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="text-center"><motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15, duration: 0.5, type: "spring" }}><CheckCircle2 className="mx-auto text-[#6fae91]" size={64} strokeWidth={1.5} /></motion.div><p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-[#f08a68]">Account ready</p><h2 className="mt-3 text-3xl font-semibold text-white">Welcome to Triply.</h2><p className="mt-3 text-[#c5d4ca]">Opening your planner...</p></motion.div></div>}<div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7 lg:px-10">
      <header className="flex items-center justify-between border-b border-[#dce8df]/20 pb-5"><TriplyLogo /><Link href="/auth" className="text-sm text-[#c5dfcf] hover:text-[#f08a68]">Already a member? Log in</Link></header>
      <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1fr_440px] lg:gap-24"><motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="max-w-xl"><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.5 }} className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-[#f08a68]">A better way to wander</motion.p><h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-7xl">Make room for more places.</h1><motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="mt-7 max-w-md text-lg leading-8 text-[#c5d4ca]">Create your Triply account and keep every small adventure close at hand.</motion.p></motion.div>
        {challengeId ? <form onSubmit={handleVerify} className="border border-[#dce8df]/20 bg-[#0d211c]/95 p-7 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f08a68]">Check your inbox</p><h2 className="mt-3 text-3xl font-semibold text-white">Verify your email.</h2><p className="mt-4 text-sm leading-6 text-[#c5d4ca]">We sent a six-digit verification code to your email. It expires soon.</p><label className="mt-8 block text-sm text-[#d5e5da]">Verification code<input name="otp" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="mt-2 w-full border border-[#dce8df]/20 bg-[#07110f]/90 px-4 py-4 text-center text-2xl tracking-[0.35em] text-white outline-none placeholder:text-[#8eaaa0] focus:border-[#f08a68]" /></label>{error && <p role="alert" className="mt-4 text-sm text-[#ff9d82]">{error}</p>}<button disabled={isSubmitting} type="submit" className="mt-8 flex w-full items-center justify-between bg-[#f08a68] px-5 py-4 font-semibold text-[#07110f] transition-colors hover:bg-[#ffb092] disabled:opacity-60">{isSubmitting ? "Verifying..." : "Verify and continue"}<ArrowRight size={19} /></button><button type="button" onClick={() => { setChallengeId(null); setOtp(""); setError(""); }} className="mt-5 w-full text-sm text-[#9ac7ac] hover:text-[#f08a68]">Start over</button></form> : <form onSubmit={handleSubmit} className="border border-[#dce8df]/20 bg-[#0d211c]/95 p-7 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f08a68]">New account</p><h2 className="mt-3 text-3xl font-semibold text-white">Join Triply.</h2><div className="mt-7 space-y-4"><label className="block text-sm text-[#d5e5da]">Your name<span className="relative mt-2 block"><UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ac7ac]" size={18} /><input name="name" required minLength={2} placeholder="What should we call you?" className="w-full border border-[#dce8df]/20 bg-[#07110f]/90 py-3.5 pl-12 pr-4 text-white outline-none placeholder:text-[#8eaaa0] focus:border-[#f08a68]" /></span></label><label className="block text-sm text-[#d5e5da]">Email address<input name="email" required type="email" placeholder="you@example.com" className="mt-2 w-full border border-[#dce8df]/20 bg-[#07110f]/90 px-4 py-3.5 text-white outline-none placeholder:text-[#8eaaa0] focus:border-[#f08a68]" /></label><label className="block text-sm text-[#d5e5da]">Password<span className="relative mt-2 block"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ac7ac]" size={18} /><input name="password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a strong password" className="w-full border border-[#dce8df]/20 bg-[#07110f]/90 py-3.5 pl-12 pr-4 text-white outline-none placeholder:text-[#8eaaa0] focus:border-[#f08a68]" /></span></label><label className="block text-sm text-[#d5e5da]">Confirm password<input name="confirmation" required type="password" placeholder="Type it again" className="mt-2 w-full border border-[#dce8df]/20 bg-[#07110f]/90 px-4 py-3.5 text-white outline-none placeholder:text-[#8eaaa0] focus:border-[#f08a68]" /></label></div>
          <div className="mt-5 grid grid-cols-2 gap-2">{rules.map((rule) => { const passed = rule.test(password); return <p key={rule.label} className={`flex items-center gap-2 text-xs ${passed ? "text-[#b5e4c7]" : "text-[#a9c0b3]"}`}>{passed ? <Check size={14} /> : <X size={14} />}{rule.label}</p>; })}</div>{error && <p role="alert" className="mt-4 text-sm text-[#ff9d82]">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-[#b5e4c7]">{message}</p>}<button disabled={isSubmitting} type="submit" className="mt-7 flex w-full items-center justify-between bg-[#f08a68] px-5 py-4 font-semibold text-[#07110f] transition-colors hover:bg-[#ffb092] disabled:opacity-60">{isSubmitting ? "Creating account..." : "Create my account"}<ArrowRight size={19} /></button>
        </form>}
      </section>
    </div></main>
  );
}
