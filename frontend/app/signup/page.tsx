// frontend/app/signup/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import TriplyLogo from "../components/shared/TriplyLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const rules = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Letter", test: (value: string) => /[a-z]/i.test(value) },
  { label: "Capital", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Number", test: (value: string) => /\d/.test(value) },
  { label: "Special", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
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
    if (name.length < 2)
      return setError("Please enter a name with at least 2 characters.");
    if (!rules.every((rule) => rule.test(password)))
      return setError("Please meet every password requirement.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (response.status === 409)
        throw new Error("That name or email is already in use.");
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.detail ?? "We could not create your account.");
      }
      const data = await response.json();
      if (!data.challenge_id || !data.user)
        throw new Error("The registration response was incomplete.");
      setChallengeId(data.challenge_id);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? `Cannot reach the backend at ${API_URL}. Start FastAPI on port 8000 and try again.`
          : requestError instanceof Error
          ? requestError.message
          : "Unable to create your account right now."
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
    <main className="min-h-screen bg-[#000000] text-white flex flex-col font-sans selection:bg-[#0a84ff] selection:text-white pb-12">
      {/* Absolute Logo Header */}
      <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <TriplyLogo />
        <Link
          href="/auth"
          className="text-[15px] font-medium text-[#0a84ff] hover:text-[#409cff] transition-colors"
        >
          Log In
        </Link>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 pt-24">
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
                <h2 className="text-[24px] font-semibold tracking-tight text-white">Account ready</h2>
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
                    Verify Email
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
                  Start Over
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="flex flex-col"
              >
                <div className="text-center mb-8">
                  <h1 className="text-[28px] font-bold tracking-tight text-white mb-2">
                    Join Triply
                  </h1>
                  <p className="text-[15px] text-[#8e8e93]">
                    Create an account to keep every adventure close at hand.
                  </p>
                </div>

                <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden flex flex-col mb-4">
                  <input
                    name="name"
                    required
                    minLength={2}
                    placeholder="Your Name"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93] border-b border-[#38383a]"
                  />
                  <input
                    name="email"
                    required
                    type="email"
                    placeholder="Email Address"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93]"
                  />
                </div>

                <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden flex flex-col">
                  <input
                    name="password"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93] border-b border-[#38383a]"
                  />
                  <input
                    name="confirmation"
                    required
                    type="password"
                    placeholder="Confirm Password"
                    className="w-full bg-transparent text-white text-[17px] p-4 outline-none placeholder:text-[#8e8e93]"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 px-2">
                  {rules.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <span
                        key={rule.label}
                        className={`text-[12px] font-medium transition-colors ${
                          passed ? "text-[#32d74b]" : "text-[#8e8e93]"
                        }`}
                      >
                        {rule.label}
                      </span>
                    );
                  })}
                </div>

                {error && <p className="mt-4 text-[13px] text-[#ff453a] text-center">{error}</p>}
                {message && <p className="mt-4 text-[13px] text-[#32d74b] text-center">{message}</p>}

                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full mt-6 bg-[#0a84ff] hover:bg-[#0071e3] active:bg-[#005ecb] disabled:opacity-50 text-white text-[17px] font-semibold py-3.5 rounded-xl transition-colors"
                >
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}