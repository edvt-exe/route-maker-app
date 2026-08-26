"use client";

import Link from "next/link";
import { ArrowRight, Compass, LockKeyhole, Mail } from "lucide-react";
import AnimatedMap from "../components/shared/AnimatedMap";

export default function AuthPage() {
	return (
		<main className="relative min-h-screen overflow-hidden bg-[#040814] text-slate-200">
			<AnimatedMap />
			<div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
				<header className="flex items-center justify-between">
					<Link href="/" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-white">
						<span className="grid size-9 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
							<Compass size={19} />
						</span>
						Triply
					</Link>
					<Link href="/" className="text-sm text-slate-400 transition-colors hover:text-white">
						Back to planner
					</Link>
				</header>

				<section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1fr_420px] lg:gap-24">
					<div className="max-w-xl">
						<p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
							<span className="h-px w-10 bg-cyan-400" /> Your next route starts here
						</p>
						<h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-7xl">
							Keep your best journeys in one place.
						</h1>
						<p className="mt-7 max-w-md text-lg leading-8 text-slate-400">
							Sign in to save route ideas, revisit your favorite waypoints, and keep exploring with less friction.
						</p>
						<div className="mt-10 flex items-center gap-4 text-sm text-slate-400">
							<span className="size-2 rounded-full bg-amber-300 shadow-[0_0_12px_#fcd34d]" />
							Built for curious detours
						</div>
					</div>

					<form className="border border-white/10 bg-slate-950/75 p-7 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-9" onSubmit={(event) => event.preventDefault()}>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Member access</p>
						<h2 className="mt-3 text-2xl font-semibold text-white">Welcome back.</h2>
						<div className="mt-8 space-y-5">
							<label className="block text-sm text-slate-300">
								Email address
								<span className="relative mt-2 block">
									<Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
									<input type="email" placeholder="you@example.com" className="w-full border border-white/10 bg-black/30 py-3.5 pl-12 pr-4 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400" />
								</span>
							</label>
							<label className="block text-sm text-slate-300">
								Password
								<span className="relative mt-2 block">
									<LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
									<input type="password" placeholder="••••••••" className="w-full border border-white/10 bg-black/30 py-3.5 pl-12 pr-4 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400" />
								</span>
							</label>
						</div>
						<button type="submit" className="mt-8 flex w-full items-center justify-between bg-cyan-300 px-5 py-4 font-semibold text-slate-950 transition-colors hover:bg-white">
							Continue exploring <ArrowRight size={19} />
						</button>
						<p className="mt-6 text-center text-sm text-slate-500">New here? <span className="text-slate-300">Create an account soon.</span></p>
					</form>
				</section>
			</div>
		</main>
	);
}
