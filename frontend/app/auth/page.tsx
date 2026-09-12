// frontend/app/auth/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import TriplyLogo from "../components/shared/TriplyLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuthPage() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "Email or password is not recognised.");
      }
      const data = await response.json();
      if (!data.challenge_id || !data.user)
        throw new Error("The login response was incomplete.");
      setChallengeId(data.challenge_id);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? `Cannot reach the backend at ${API_URL}. Start FastAPI on port 8000 and try again.`
          : requestError instanceof Error
          ? requestError.message
          : "Unable to sign in right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code: otp }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.detail ?? "That verification code is not valid.");
      if (!data.access_token || !data.user)
        throw new Error("The verification response was incomplete.");
      localStorage.setItem("triply_token", data.access_token);
      localStorage.setItem("triply_user", JSON.stringify(data.user));
      setIsSuccess(true);
      window.setTimeout(() => window.location.assign("/"), 1100);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? `Cannot reach the backend at ${API_URL}. Start FastAPI on port 8000 and try again.`
          : requestError instanceof Error
          ? requestError.message
          : "Unable to verify your code right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#000000] text-white flex flex-col font-sans selection:bg-[#0a84ff] selection:text-white">
      {/* Absolute Logo Header */}
      <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center">
        <TriplyLogo />
        <Link
          href="/"
          className="text-[15px] font-medium text-[#0a84ff] hover:text-[#409cff] transition-colors"
        >
          Cancel
        </Link>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col justify-center items-center px-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center text-center"
              >
                <CheckCircle2 size={64} className="text-[#32d74b] mb-4" strokeWidth={1.5} />
                <h2 className="text-[24px] font-semibold tracking-tight text-white">Welcome back</h2>
                <p className="mt-2 text-[15px] text-[#8e8e93]">Opening your planner...</p>
              </motion.div>
            ) : challengeId ? (
              <motion.form
                key="otp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleVerify}
                className="flex flex-col"
              >
                <div className="text-center mb-8">
                  <h1 className="text-[28px] font-bold tracking-tight text-white mb-2">
                    Enter Code
                  </h1>
                  <p className="text-[15px] text-[#8e8e93]">
                    We sent a six-digit verification code to your email.
                  </p>
                </div>

                <input
                  name="otp"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-[#1c1c1e] text-white text-[32px] text-center tracking-[0.5em] rounded-2xl p-4 outline-none placeholder:text-[#38383a] focus:bg-[#2c2c2e] transition-colors"
                />

                {error && <p className="mt-4 text-[13px] text-[#ff453a] text-center">{error}</p>}

                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full mt-6 bg-[#0a84ff] hover:bg-[#0071e3] active:bg-[#005ecb] disabled:opacity-50 text-white text-[17px] font-semibold py-3.5 rounded-xl transition-colors"
                >
                  {isSubmitting ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallengeId(null);
                    setOtp("");
                    setError("");
                  }}
                  className="w-full mt-4 text-[15px] text-[#0a84ff] hover:text-[#409cff] transition-colors"
                >
                  Use a different account
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="flex flex-col"
              >
                <div className="text-center mb-8">
                  <h1 className="text-[28px] font-bold tracking-tight text-white mb-2">
                    Log In
                  </h1>
                  <p className="text-[15px] text-[#8e8e93]">
                    Sign in to access your saved trips and plans.
                  </p>
                </div>

                <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden flex flex-col">
                  <input
                    name="identifier"
                    required
                    minLength={2}
                    placeholder="Email or Name"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93] border-b border-[#38383a]"
                  />
                  <input
                    name="password"
                    required
                    type="password"
                    placeholder="Password"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93]"
                  />
                </div>

                {error && <p className="mt-4 text-[13px] text-[#ff453a] text-center">{error}</p>}

                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full mt-6 bg-[#0a84ff] hover:bg-[#0071e3] active:bg-[#005ecb] disabled:opacity-50 text-white text-[17px] font-semibold py-3.5 rounded-xl transition-colors"
                >
                  {isSubmitting ? "Signing In..." : "Continue"}
                </button>
                
                <p className="mt-6 text-center text-[15px] text-[#8e8e93]">
                  New to Triply?{" "}
                  <Link href="/signup" className="text-[#0a84ff] hover:text-[#409cff] transition-colors">
                    Create an account
                  </Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}