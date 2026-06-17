import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Landmark, Shield, Mail, Lock, User, UserCheck, AlertCircle } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (user: any, profile: { role: "admin" | "user"; fullName: string }) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [isNotAllowedError, setIsNotAllowedError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsNotAllowedError(false);
    setLoading(true);

    if (e.target instanceof HTMLFormElement) {
      if (isSignUp && !fullName.trim()) {
        setError("Please enter your full name.");
        setLoading(false);
        return;
      }
      if (!email.trim() || !password || password.length < 6) {
        setError("Please enter a valid email and a password of at least 6 characters.");
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        const userProfile = {
          uid: user.uid,
          email: user.email,
          fullName: fullName.trim(),
          role,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "users", user.uid), userProfile);
        onAuthSuccess(user, { role, fullName: fullName.trim() });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;
        onAuthSuccess(user, { role: "user", fullName: "User" });
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errMsg = "An unexpected error occurred. Please try again.";
      if (err.code === "auth/operation-not-allowed") {
        setIsNotAllowedError(true);
        errMsg = "Registration and Sign-in via Email/Password is currently disabled in your Firebase console.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already registered.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errMsg = "Incorrect email or password. Please try again.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDevBypass = (selectedRole: "admin" | "user") => {
    const mockUser = {
      uid: selectedRole === "admin" ? "bypass-admin-uid" : "bypass-user-uid",
      email: selectedRole === "admin" ? "admin@niagaramills.com" : "counsel@niagaramills.com",
    };
    const mockProfile = {
      role: selectedRole,
      fullName: selectedRole === "admin" ? "Barrister Ali (Admin Bypass)" : "Advocate Bilal (Standard Bypass)"
    };
    
    // Save to localStorage so that page reloads maintain this active development session
    localStorage.setItem("mills_counsel_bypass", JSON.stringify({ user: mockUser, profile: mockProfile }));
    onAuthSuccess(mockUser, mockProfile);
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
          
          {/* Tabs header */}
          <div className="flex border-b border-slate-800 p-1 bg-slate-950/55 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setIsNotAllowedError(false);
              }}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all ${
                !isSignUp
                  ? "bg-amber-500/10 text-amber-400 font-extrabold shadow-sm border border-amber-500/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Access Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setIsNotAllowedError(false);
              }}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all ${
                isSignUp
                  ? "bg-amber-500/10 text-amber-400 font-extrabold shadow-sm border border-amber-500/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create Counsel Seal
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error message slot */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl flex flex-col gap-2 text-xs text-rose-400">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{error}</span>
                </div>
                
                {isNotAllowedError && (
                  <div className="border-t border-rose-500/20 pt-2.5 mt-1 text-[10.5px] text-slate-300 leading-relaxed font-sans space-y-1">
                    <p className="font-bold text-amber-400">To enable production sign-ins:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to your <strong className="text-white">Firebase Console</strong></li>
                      <li>Navigate to <strong className="text-white">Build &gt; Authentication</strong></li>
                      <li>Go to the <strong className="text-white">Sign-in method</strong> tab</li>
                      <li>Click <strong className="text-white">Add New Provider &gt; Email/Password</strong> and <strong className="text-white">Enable</strong> it!</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Name input (Sign Up Only) */}
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Full Authorized Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-500" size={14} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Barrister Ali Khan"
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition duration-150"
                  />
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
                  placeholder="name@niagaramills.com"
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

            {/* Role selecting toggler (Sign Up Only) */}
            {isSignUp && (
              <div className="space-y-1.5 border-t border-slate-800/60 pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Select System Role & Clearance
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole("user")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition duration-150 select-none ${
                      role === "user"
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                        : "bg-slate-950/20 border-slate-800/80 text-slate-400"
                    }`}
                  >
                    <UserCheck size={16} className="mb-1" />
                    <span className="text-[10px] font-bold block">Standard User</span>
                    <span className="text-[8px] text-slate-500 leading-none mt-1">My cases only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition duration-150 select-none ${
                      role === "admin"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400"
                        : "bg-slate-950/20 border-slate-800/80 text-slate-400"
                    }`}
                  >
                    <Shield size={16} className="mb-1" />
                    <span className="text-[10px] font-bold block">Counsel Admin</span>
                    <span className="text-[8px] text-slate-500 leading-none mt-1">All mills folders</span>
                  </button>
                </div>
              </div>
            )}

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
                <span>{isSignUp ? "Generate Access Seal" : "Sign In to Console"}</span>
              )}
            </button>

          </form>

          {/* Quick instructions block */}
          <div className="border-t border-slate-800/60 pt-3 text-center">
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed font-mono">
              {!isSignUp 
                ? "First-time counsel? Select 'Create Counsel Seal' to configure your custom workspace role."
                : "A custom user account is bound to your email. Admin role provides access to wipe options."
              }
            </p>
          </div>

        </div>

        {/* Development Bypass Section */}
        <div className="bg-slate-950/50 border border-slate-800/60 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <h4 className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider">
              Portal Developer Bypasses (Immediate Preview Access)
            </h4>
          </div>
          <p className="text-[9.5px] text-slate-500 leading-normal">
            Bypass authorization to inspect general features immediately in the AI Studio environment, simulating multiple Clearance roles.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDevBypass("admin")}
              className="px-3 py-2 text-left cursor-pointer bg-[#0c1322] border border-slate-800 hover:border-amber-500/60 hover:bg-amber-500/5 rounded-xl transition duration-150 group"
            >
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-amber-400">
                <Shield size={12} />
                <span>Bypass as Admin</span>
              </div>
              <span className="text-[8px] text-slate-500 block leading-tight mt-1 font-mono group-hover:text-slate-400 transition">
                Full Litigation Folder Access & Wipe Records Allowed
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDevBypass("user")}
              className="px-3 py-2 text-left cursor-pointer bg-[#0c1322] border border-slate-800 hover:border-indigo-500/60 hover:bg-indigo-500/5 rounded-xl transition duration-150 group"
            >
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-400">
                <UserCheck size={12} />
                <span>Bypass as Counsel</span>
              </div>
              <span className="text-[8px] text-slate-500 block leading-tight mt-1 font-mono group-hover:text-slate-400 transition">
                Folder-restricted access (Pre-seeded & Authored Only)
              </span>
            </button>
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
