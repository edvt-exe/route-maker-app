"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type Account = { name: string; email: string };

// Custom iOS-style Toggle Component
const IOSToggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    type="button"
    onClick={() => onChange(!checked)} 
    className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-300 ease-in-out shrink-0 ${checked ? 'bg-[#32d74b]' : 'bg-[#39393d]'}`}
  >
    <div className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
  </button>
);

// Reusable Row Component
const ListRow = ({ 
  label, 
  children 
}: { 
  label: string; 
  children: React.ReactNode; 
}) => (
  <div className="flex items-center justify-between py-3 pl-4 pr-4 bg-[#1c1c1e]">
    <span className="text-[17px] text-white tracking-tight">{label}</span>
    <div className="flex items-center gap-3">
      {children}
    </div>
  </div>
);

// iOS Style Divider (indented from the left)
const Divider = () => (
  <div className="w-full pl-4 bg-[#1c1c1e]">
    <div className="h-[1px] bg-[#38383a] w-full" />
  </div>
);

export default function SettingsPage() {
  const [account, setAccount] = useState<Account>({ name: "", email: "" });
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [routeReminders, setRouteReminders] = useState(true);
  const [privateRoutes, setPrivateRoutes] = useState(true);

  useEffect(() => {
    const storedAccount = localStorage.getItem("triply_user");
    if (storedAccount) {
      try { 
        setAccount(JSON.parse(storedAccount)); 
      } catch { 
        localStorage.removeItem("triply_user"); 
      }
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("triply_token");
    localStorage.removeItem("triply_user");
    window.location.assign("/auth");
  };

  return (
    <main className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#0a84ff] selection:text-white pb-12">
      <div className="mx-auto max-w-2xl px-4 py-10">
        
        {/* Header */}
        <header className="relative flex items-center justify-center mb-10 h-8">
          <Link 
            href="/" 
            className="absolute left-0 flex items-center gap-1 text-[17px] text-[#0a84ff] hover:text-[#409cff] transition-colors"
          >
            <ChevronLeft size={24} className="-ml-2" /> 
            <span>Back</span>
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight text-white">Settings</h1>
        </header>

        <div className="space-y-8">
          
          {/* Section 1: Profile */}
          <section>
            <h2 className="text-[13px] text-[#8e8e93] uppercase tracking-wider mb-2 px-4">Profile</h2>
            <div className="rounded-2xl overflow-hidden bg-[#1c1c1e]">
              <ListRow label="Name">
                <input 
                  type="text"
                  value={account.name} 
                  onChange={(e) => setAccount({ ...account, name: e.target.value })} 
                  className="bg-transparent text-right text-[17px] text-[#8e8e93] outline-none w-48 placeholder-[#38383a]" 
                  placeholder="Your Name"
                />
              </ListRow>
              <Divider />
              <ListRow label="Email">
                <span className="text-[17px] text-[#8e8e93] truncate max-w-[200px]">
                  {account.email || 'Not provided'}
                </span>
              </ListRow>
            </div>
          </section>

          {/* Section 2: Preferences */}
          <section>
            <h2 className="text-[13px] text-[#8e8e93] uppercase tracking-wider mb-2 px-4">Preferences</h2>
            <div className="rounded-2xl overflow-hidden bg-[#1c1c1e]">
              <ListRow label="Trip Updates">
                <IOSToggle checked={emailUpdates} onChange={setEmailUpdates} />
              </ListRow>
              <Divider />
              <ListRow label="Route Reminders">
                <IOSToggle checked={routeReminders} onChange={setRouteReminders} />
              </ListRow>
              <Divider />
              <ListRow label="Private Routes">
                <IOSToggle checked={privateRoutes} onChange={setPrivateRoutes} />
              </ListRow>
            </div>
            <p className="text-[13px] text-[#8e8e93] mt-2 px-4 leading-tight">
              Private routes keep your saved itineraries visible only to you.
            </p>
          </section>

          {/* Section 3: Danger Zone */}
          <section className="pt-2">
            <button 
              type="button" 
              onClick={handleSignOut} 
              className="w-full flex items-center justify-center bg-[#1c1c1e] active:bg-[#2c2c2e] text-[#ff453a] text-[17px] py-3.5 rounded-2xl transition-colors"
            >
              Sign Out
            </button>
          </section>
          
        </div>
      </div>
    </main>
  );
}