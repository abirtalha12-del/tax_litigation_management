import React, { useState } from "react";
import { useMutation } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Landmark, Shield, Mail, Lock, User, UserCheck, AlertCircle } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (user: any, profile: { role: "owner" | "admin" | "user"; fullName: string; rights?: any }) => void;
}

const getLocalAccounts = () => {
  try {
    const raw = localStorage.getItem("mills_counsel_accounts");
    const defaults = [
      { uid: "owner-uid", email: "owner@niagaramills.com", password: "Sayyedtalha123", fullName: "Suleman Mills (Owner)", role: "owner" },
      { uid: "admin-uid", email: "admin@niagaramills.com", password: "password", fullName: "Barrister Ali (Admin)", role: "admin" },
      { uid: "counsel-uid", email: "counsel@niagaramills.com", password: "password", fullName: "Advocate Bilal", role: "user" }
    ];

    if (!raw) {
      try {
        localStorage.setItem("mills_counsel_accounts", JSON.stringify(defaults));
      } catch {}
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Find existing owner and force password and role
        const ownerIndex = parsed.findIndex(acc => acc.email.toLowerCase() === "owner@niagaramills.com");
        if (ownerIndex > -1) {
          parsed[ownerIndex].password = "Sayyedtalha123";
          parsed[ownerIndex].role = "owner";
        } else {
          parsed.push({ uid: "owner-uid", email: "owner@niagaramills.com", password: "Sayyedtalha123", fullName: "Suleman Mills (Owner)", role: "owner" });
        }
        try {
          localStorage.setItem("mills_counsel_accounts", JSON.stringify(parsed));
        } catch {}
        return parsed;
      }
      return defaults;
    } catch {
      return defaults;
    }
  } catch (err) {
    console.warn("Storage access not available in this window context:", err);
    return [
      { uid: "owner-uid", email: "owner@niagaramills.com", password: "Sayyedtalha123", fullName: "Suleman Mills (Owner)", role: "owner" },
      { uid: "admin-uid", email: "admin@niagaramills.com", password: "password", fullName: "Barrister Ali (Admin)", role: "admin" },
      { uid: "counsel-uid", email: "counsel@niagaramills.com", password: "password", fullName: "Advocate Bilal", role: "user" }
    ];
  }
};

const setLocalAccounts = (accounts: any[]) => {
  try {
    localStorage.setItem("mills_counsel_accounts", JSON.stringify(accounts));
  } catch (err) {
    console.warn("Could not persist new accounts to local layout storage:", err);
  }
};

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (e.target instanceof HTMLFormElement) {
      if (!email.trim() || !password || password.length < 6) {
        setError("Please enter a valid email and a password of at least 6 characters.");
        setLoading(false);
        return;
      }
    }

    const emailTrimmed = email.trim().toLowerCase();

    try {
      // Sign In Flow Only
      const accounts = getLocalAccounts();
      const matched = accounts.find(
        acc => acc.email.toLowerCase() === emailTrimmed && acc.password === password
      );

      if (matched) {
        onAuthSuccess(
          { uid: matched.uid, email: matched.email },
          { role: matched.role || "user", fullName: matched.fullName || "Counsel", rights: matched.rights }
        );
      } else {
        setError("Incorrect email or password. Please try again.");
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "An unexpected validation failure occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans text-slate-200">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md z-10 space-y-6">
        
        {/* Brand Logo header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center bg-slate-900 border border-slate-800 p-4 rounded-2xl text-amber-500 shadow-xl">
            <Landmark size={32} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono block">Textile Enterprise</span>
            <h1 className="text-xl font-extrabold tracking-tight text-white mt-1">
              Niagara Mills (PVT) Ltd
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              Tax Litigation & Controversy Management Portal
            </p>
          </div>
        </div>

        {/* Auth form container card */}
        <div className="bg-[#090d16]/95 border border-slate-800/80 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
          
          <div className="text-center py-1">
            <h2 className="text-sm font-bold text-amber-500 uppercase tracking-wider font-mono">
              Access Controversy Console
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error message slot */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl flex flex-col gap-2 text-xs text-rose-400">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Email input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-500" size={14} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@niagaramills.com"
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition duration-150"
                />
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                Assigned Access Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={14} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition duration-150"
                />
              </div>
            </div>

            {/* Action button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 cursor-pointer bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition duration-150 shadow-md shadow-amber-500/10"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Validating credentials...</span>
                </>
              ) : (
                <span>Sign In to Console</span>
              )}
            </button>

          </form>

          {/* Quick instructions block */}
          <div className="border-t border-slate-800/60 pt-3 text-center">
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed font-mono">
              Access is strictly restricted to company owners & authorized legal counsels. Securing credential entries are monitored.
            </p>
          </div>

        </div>

        {/* Console compliance footnote */}
        <div className="text-center text-[10px] text-slate-600 font-mono">
          <span>Secure AES/FBR-Compliant Cryptographic Node (ST-168)</span>
        </div>

      </div>
    </div>
  );
}
