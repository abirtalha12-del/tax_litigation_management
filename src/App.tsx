import React, { useState, useEffect } from "react";
import { initialCases } from "./mockData";
import { LitigationCase, CaseChronologyEvent } from "./types";
import Dashboard from "./components/Dashboard";
import Uploader from "./components/Uploader";
import CaseRegister from "./components/CaseRegister";
import SheetsViewer from "./components/SheetsViewer";
import CaseDetailModal from "./components/CaseDetailModal";
import SettingsPanel from "./components/SettingsPanel";
import { Briefcase, FileText, Landmark, LayoutDashboard, Calendar, Search, Trash, Edit2, CheckCircle2, AlertTriangle, ShieldCheck, Clock, PlusCircle, LogOut, Sliders } from "lucide-react";
import { useQuery, useMutation } from "./lib/convex";
import { api } from "../convex/_generated/api";
import AuthScreen from "./components/AuthScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<LitigationCase | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ role: "owner" | "admin" | "user"; fullName: string } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Nice Toast & Confirm States for non-blocking browser sandbox compliance
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage((curr) => curr === message ? null : curr);
    }, 4500);
  };

  const triggerConfirm = (message: string, onConfirm: () => void | Promise<void>, description?: string) => {
    setConfirmDialog({ message, onConfirm, description });
  };

  // Ready Convex hooks
  const loadedCases = useQuery(api.cases.list);
  const cases: LitigationCase[] = loadedCases || [];

  const addCase = useMutation(api.cases.add);
  const deleteCase = useMutation(api.cases.deleteCase);

  // Subscribe to persistent authentication state
  useEffect(() => {
    const checkAuthStatus = () => {
      let cachedUser = null;
      try {
        cachedUser = sessionStorage.getItem("mills_logged_in_user");
      } catch (err) {
        console.warn("sessionStorage read blocked in sandboxed environment:", err);
      }

      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          setCurrentUser(parsed.user);
          setUserProfile(parsed.profile);
        } catch (e) {
          try {
            sessionStorage.removeItem("mills_logged_in_user");
          } catch {}
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoadingAuth(false);
    };

    checkAuthStatus();
  }, []);

  const handleAuthSuccess = (user: any, profile: { role: "owner" | "admin" | "user"; fullName: string }) => {
    setCurrentUser(user);
    setUserProfile(profile);
    try {
      sessionStorage.setItem("mills_logged_in_user", JSON.stringify({ user, profile }));
    } catch (err) {
      console.warn("sessionStorage write blocked in sandboxed environment:", err);
    }
  };

  // Counsel users have permissions to view and edit all litigation dossiers, so no filtering by author is required.
  const filteredCases = cases;

  // Merge & Master Database alignment logic powered by Convex
  const handleCommitCase = async (newCase: LitigationCase, updatedExisting: boolean) => {
    let finalCase: LitigationCase = {
      ...newCase,
      createdBy: currentUser?.uid || "public",
      createdByEmail: currentUser?.email || "system@niagaramills.com"
    };

    if (updatedExisting) {
      // Find matching case
      const existing = cases.find(
        (c) => 
          c.id === newCase.id || 
          c.caseInfo.referenceNumber.toLowerCase().trim() === newCase.caseInfo.referenceNumber.toLowerCase().trim()
      );

      if (existing) {
        // Merge Chronology event elements safely without duplicates
        const mergedChronology = [...existing.chronology];
        newCase.chronology.forEach((newEv) => {
          const exists = mergedChronology.some(
            (exEv) => exEv.date === newEv.date && exEv.event.toLowerCase().trim() === newEv.event.toLowerCase().trim()
          );
          if (!exists) {
            mergedChronology.push(newEv);
          }
        });

        // Merge source files
        const mergedSourceFiles = Array.from(new Set([...existing.sourceFiles, ...newCase.sourceFiles]));

        finalCase = {
          ...existing,
          caseInfo: {
            ...existing.caseInfo,
            ...newCase.caseInfo,
            caseId: existing.id // protect original id
          },
          financialInfo: {
            ...existing.financialInfo,
            ...newCase.financialInfo,
            totalExposure: (newCase.financialInfo.taxDemand || 0) + (newCase.financialInfo.penalty || 0) + (newCase.financialInfo.defaultSurcharge || 0)
          },
          proceedingsInfo: {
            ...existing.proceedingsInfo,
            ...newCase.proceedingsInfo,
            hearingDates: Array.from(new Set([...existing.proceedingsInfo.hearingDates, ...newCase.proceedingsInfo.hearingDates]))
          },
          outcomeInfo: {
            ...existing.outcomeInfo,
            ...newCase.outcomeInfo
          },
          chronology: mergedChronology.sort((a,b) => b.date.localeCompare(a.date)),
          sourceFiles: mergedSourceFiles,
          updatedAt: new Date().toISOString()
        };
      }
    }

    try {
      await addCase(finalCase);
    } catch (error) {
      console.error("Convex write error:", error);
    }
  };

  const handleAddCaseManual = async (manualCase: LitigationCase) => {
    try {
      const finalCase = {
        ...manualCase,
        createdBy: currentUser?.uid || "public",
        createdByEmail: currentUser?.email || "system@niagaramills.com"
      };
      await addCase(finalCase);
    } catch (error) {
      console.error("Convex manual write error:", error);
    }
  };

  const handleImportMasterCases = async (importedList: LitigationCase[], isMerge: boolean) => {
    if (isMerge) {
      for (const newCase of importedList) {
        let finalCase: LitigationCase = {
          ...newCase,
          createdBy: currentUser?.uid || "public",
          createdByEmail: currentUser?.email || "system@niagaramills.com"
        };
        const existing = cases.find(
          (c) => 
            c.id === newCase.id || 
            (c.caseInfo.referenceNumber && newCase.caseInfo.referenceNumber && 
             c.caseInfo.referenceNumber.toLowerCase().trim() === newCase.caseInfo.referenceNumber.toLowerCase().trim())
        );

        if (existing) {
          const mergedChronology = [...existing.chronology];
          newCase.chronology.forEach((newEv) => {
            const exists = mergedChronology.some(
              (exEv) => exEv.date === newEv.date && exEv.event.toLowerCase().trim() === newEv.event.toLowerCase().trim()
            );
            if (!exists) {
              mergedChronology.push(newEv);
            }
          });

          const mergedSourceFiles = Array.from(new Set([...existing.sourceFiles, ...newCase.sourceFiles]));

          finalCase = {
            ...existing,
            caseInfo: {
              ...existing.caseInfo,
              ...newCase.caseInfo,
              caseId: existing.id
            },
            financialInfo: {
              ...existing.financialInfo,
              ...newCase.financialInfo,
              totalExposure: (newCase.financialInfo.taxDemand || 0) + (newCase.financialInfo.penalty || 0) + (newCase.financialInfo.defaultSurcharge || 0)
            },
            proceedingsInfo: {
              ...existing.proceedingsInfo,
              ...newCase.proceedingsInfo,
              hearingDates: Array.from(new Set([...existing.proceedingsInfo.hearingDates, ...(newCase.proceedingsInfo?.hearingDates || [])]))
            },
            outcomeInfo: {
              ...existing.outcomeInfo,
              ...newCase.outcomeInfo
            },
            chronology: mergedChronology.sort((a,b) => b.date.localeCompare(a.date)),
            sourceFiles: mergedSourceFiles,
            updatedAt: new Date().toISOString()
          };
        }

        try {
          await addCase(finalCase);
        } catch (error) {
          console.error("Convex import write error:", error);
        }
      }
    } else {
      // Clear current cases and import fresh
      try {
        const idsToClear = cases.map(c => c.id);
        for (const id of idsToClear) {
          await deleteCase({ id });
        }
        for (const c of importedList) {
          const withUser = {
            ...c,
            createdBy: currentUser?.uid || "public",
            createdByEmail: currentUser?.email || "system@niagaramills.com"
          };
          await addCase(withUser);
        }
      } catch (error) {
        console.error("Convex overwrite import error:", error);
      }
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (userProfile?.role === "user") {
      showToast("Clearance Denied. Counsel users do not have authorization to delete litigation dossiers.", "error");
      return;
    }
    triggerConfirm(
      `Expunge Dossier ${caseId}?`,
      async () => {
        try {
          await deleteCase({ id: caseId });
          showToast(`Litigation Dossier ${caseId} was deleted successfully from the database.`, "success");
        } catch (error) {
          showToast(`Failed to delete Litigation Dossier ${caseId}. Please try again.`, "error");
          console.error("Delete Error:", error);
        }
      },
      "This action will permanently purge this item from the secure primary ledger. It cannot be reverted."
    );
  };

  const handleClearAllData = async () => {
    if (userProfile?.role !== "owner") {
      showToast("Clearance Denied. Wiping database registers requires Level 1: Owner authorization.", "error");
      return;
    }
    triggerConfirm(
      "Expunge All litigation dossiers?",
      async () => {
        try {
          // Clear local storage cache immediately if in fallback/localStorage mode
          try {
            localStorage.setItem("mills_counsel_cases", JSON.stringify([]));
          } catch (e) {}

          const idsToDelete = cases.map(c => c.id);
          // Sequential deletion avoids overlapping localStorage race conditions
          for (const id of idsToDelete) {
            await deleteCase({ id });
          }
          showToast("The entire database was wiped successfully.", "success");
        } catch (error) {
          showToast("Failed to wipe database records. Please try again.", "error");
          console.error("Wipe Error:", error);
        }
      },
      "CRITICAL: This will instantly and permanently erase every litigation folder and secure dossier inside Niagara Mills portal. This action is irreversible."
    );
  };

  const handleLoadDemoData = async () => {
    try {
      for (const c of initialCases) {
        await addCase(c);
      }
      showToast("Demonstration cases populated successfully into your database.", "success");
    } catch (error) {
      showToast("Failed to populate demonstration cases. Please try again.", "error");
      console.error("Seed Error:", error);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("mills_logged_in_user");
      localStorage.removeItem("mills_counsel_bypass");
    } catch (err) {
      console.warn("Storage clearing blocked in sandboxed environment:", err);
    }
    setCurrentUser(null);
    setUserProfile(null);
  };

  const handleUpdateCaseManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;

    const finalCase = {
      ...editingCase,
      financialInfo: {
        ...editingCase.financialInfo,
        totalExposure: (editingCase.financialInfo.taxDemand || 0) + (editingCase.financialInfo.penalty || 0) + (editingCase.financialInfo.defaultSurcharge || 0)
      },
      updatedAt: new Date().toISOString()
    };

    try {
      await addCase(finalCase);
      setEditingCase(null);
    } catch (error) {
      console.error("Convex update manual error:", error);
    }
  };

  const activeCaseObjForPopup = cases.find((c) => c.id === selectedCaseId) || null;

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-slate-200 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 font-mono tracking-widest uppercase animate-pulse">Initializing Portal Security...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col font-sans text-slate-200 animate-fade-in animate-duration-300">
      
      {/* Top Banner Header */}
      <header className="bg-[#090d16] border-b border-slate-800/80 text-white shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-xl text-amber-500 border border-slate-800/80 shadow-inner">
              <Landmark size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono block">Textile Enterprise</span>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 leading-none mt-0.5">
                Niagara Mills (PVT) Ltd
              </h1>
            </div>
          </div>

          {/* Pakistan FBR / PRA Compliance Status / Profile */}
          <div className="flex items-center gap-4 text-xs flex-wrap sm:flex-nowrap">
            {currentUser && userProfile && (
              <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/85 p-1.5 pl-3 pr-2 rounded-xl shrink-0 shadow-inner">
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100 text-[11px] leading-tight">
                      {userProfile.fullName}
                    </span>
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                      userProfile.role === "owner"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        : userProfile.role === "admin"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                    }`}>
                      {userProfile.role === "owner" ? "Owner" : userProfile.role === "admin" ? "Admin" : "Standard"}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono leading-none mt-0.5 max-w-[155px] truncate">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerConfirm(
                      "Sign out of active session?",
                      () => {
                        handleLogout();
                      },
                      "Securely terminates your active legal clearance key and returns to the lockscreen."
                    );
                  }}
                  className="p-1 px-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Sign Out Session"
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 border border-slate-800/80 px-3 py-1.5 rounded-lg text-slate-400 shrink-0">
              <Clock size={14} className="text-slate-500" />
              <span> Karāchi / Pakistan TZ • ST-168</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-400 font-semibold shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>FBR / PRA Connected</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Workspace Body wrapper */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-6 gap-6 min-h-0">
        
        {/* Navigation Sidebar */}
        <aside className="lg:w-64 flex flex-col gap-2 shrink-0">
          
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">Console Sections</span>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
              activeTab === "dashboard"
                ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <LayoutDashboard size={16} />
            Overview Dashboard
          </button>

          <button
            onClick={() => setActiveTab("uploader")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
              activeTab === "uploader"
                ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <FileText size={16} />
            AI Document Analysis
          </button>

          <button
            onClick={() => setActiveTab("register")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
              activeTab === "register"
                ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Briefcase size={16} />
            Litigation Register
          </button>

          <button
            onClick={() => setActiveTab("sheets")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
              activeTab === "sheets"
                ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Calendar size={16} />
            Consolidated Sheets
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
              activeTab === "settings"
                ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Sliders size={16} />
            Settings & Clearance
          </button>

          <div className="mt-auto border-t border-slate-800/80 pt-4 px-3 space-y-2 mt-8">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Enterprise Target</span>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/70 space-y-1 text-center shadow-3xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Controversy Audited</span>
              <span className="text-sm font-extrabold block text-amber-400">
                PKR {(filteredCases.reduce((sum, c) => sum + (c.financialInfo.totalExposure || 0), 0) / 10000000).toFixed(2)} Cr
              </span>
            </div>
            
            {userProfile?.role === "owner" && (
              <button
                onClick={handleClearAllData}
                className="w-full mt-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
                title="Delete all data from the litigation database permanently"
              >
                <Trash size={12} />
                Wipe Database Records
              </button>
            )}

            {userProfile?.role === "owner" && filteredCases.length === 0 && (
              <button
                onClick={handleLoadDemoData}
                className="w-full mt-2 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer animate-pulse"
                title="Populate the database with default demonstration tax litigation folders"
              >
                <PlusCircle size={12} />
                Load Demo Cases
              </button>
            )}

            <button
              onClick={() => {
                triggerConfirm(
                  "Sign out of active session?",
                  () => {
                    handleLogout();
                  },
                  "Securely terminates your active legal clearance key and returns to the lockscreen."
                );
              }}
              className="w-full mt-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
              title="Securely close the active session and return to authentication"
            >
              <LogOut size={12} />
              Secure Log Out
            </button>
          </div>
        </aside>

        {/* Content workspace core */}
        <main className="flex-1 bg-[#090d16]/90 border border-slate-850 p-6 md:p-8 rounded-3xl min-w-0 shadow-3xs overflow-y-auto">
          {activeTab === "dashboard" && (
            <Dashboard 
              cases={filteredCases} 
              onSelectCase={(id) => setSelectedCaseId(id)} 
              onSwitchTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "uploader" && (
            <Uploader 
              onCommitCase={handleCommitCase} 
              existingCases={filteredCases}
            />
          )}

          {activeTab === "register" && (
            <CaseRegister
              cases={filteredCases}
              userRole={userProfile?.role || "user"}
              onSelectCase={(id) => setSelectedCaseId(id)}
              onEditCase={(c) => setEditingCase(c)}
              onDeleteCase={handleDeleteCase}
              onAddCase={handleAddCaseManual}
              onImportCases={handleImportMasterCases}
            />
          )}

          {activeTab === "sheets" && (
            <SheetsViewer cases={filteredCases} />
          )}

          {activeTab === "settings" && (
            <SettingsPanel 
              currentUser={currentUser}
              userProfile={userProfile}
              onProfileUpdate={(nextProf) => setUserProfile(nextProf)}
              onWipeDatabase={handleClearAllData}
              onLoadDemo={handleLoadDemoData}
              casesCount={filteredCases.length}
              showToast={showToast}
              showConfirm={triggerConfirm}
            />
          )}
        </main>

      </div>

      {/* Case detailed Dossier Popup */}
      <CaseDetailModal 
        caseObj={activeCaseObjForPopup} 
        onClose={() => setSelectedCaseId(null)} 
      />

      {/* Instant Direct row edit modal */}
      {editingCase && (
        <div className="fixed inset-0 bg-[#020617]/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 max-w-2xl w-full shadow-lg space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Modify Register Fields: {editingCase.id}</h2>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="text-slate-400 hover:text-white font-bold p-1 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCaseManual} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Taxpayer Enterprise</label>
                  <input
                    type="text"
                    value={editingCase.caseInfo.taxpayerName}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      caseInfo: { ...editingCase.caseInfo, taxpayerName: e.target.value }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">National Tax Number (NTN)</label>
                  <input
                    type="text"
                    value={editingCase.caseInfo.ntn}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      caseInfo: { ...editingCase.caseInfo, ntn: e.target.value }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Sales Tax Reg STRN</label>
                  <input
                    type="text"
                    value={editingCase.caseInfo.strn}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      caseInfo: { ...editingCase.caseInfo, strn: e.target.value }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Tax Period</label>
                  <input
                    type="text"
                    value={editingCase.caseInfo.taxPeriod}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      caseInfo: { ...editingCase.caseInfo, taxPeriod: e.target.value }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Primary Demand Principal (PKR)</label>
                  <input
                    type="number"
                    value={editingCase.financialInfo.taxDemand}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      financialInfo: { ...editingCase.financialInfo, taxDemand: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Penalties levied (PKR)</label>
                  <input
                    type="number"
                    value={editingCase.financialInfo.penalty}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      financialInfo: { ...editingCase.financialInfo, penalty: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Default Surcharge (PKR)</label>
                  <input
                    type="number"
                    value={editingCase.financialInfo.defaultSurcharge}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      financialInfo: { ...editingCase.financialInfo, defaultSurcharge: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Current Proceedings Stage</label>
                  <input
                    type="text"
                    value={editingCase.proceedingsInfo.currentStage}
                    onChange={(e) => setEditingCase({
                      ...editingCase,
                      proceedingsInfo: { ...editingCase.proceedingsInfo, currentStage: e.target.value }
                    })}
                    className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Dossier Recovery Status</label>
                <input
                  type="text"
                  value={editingCase.outcomeInfo.currentStatus}
                  onChange={(e) => setEditingCase({
                    ...editingCase,
                    outcomeInfo: { ...editingCase.outcomeInfo, currentStatus: e.target.value }
                  })}
                  className="w-full bg-[#020617]/60 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setEditingCase(null)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded text-xs font-semibold text-slate-350 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded text-xs font-bold transition cursor-pointer"
                >
                  Commit Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Non-Blocking Custom Confirmation Modal Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617]/90 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#090d16] border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="mt-2 w-12 h-12 bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono leading-normal">
                {confirmDialog.message}
              </h3>
              {confirmDialog.description && (
                <p className="text-[11px] text-slate-400 leading-normal font-mono">
                  {confirmDialog.description}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await cb();
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Non-Blocking Toast Notification pop */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-xs max-w-md ${
            toastType === "success" 
              ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-400"
              : toastType === "error"
                ? "bg-[#18080c]/95 border-rose-500/40 text-rose-400"
                : "bg-[#0a0f1d]/95 border-indigo-500/40 text-indigo-400"
          }`}>
            <span className="font-semibold">{toastMessage}</span>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white font-bold ml-auto font-mono text-[10px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
