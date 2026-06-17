import React, { useState, useEffect } from "react";
import { initialCases } from "./mockData";
import { LitigationCase, CaseChronologyEvent } from "./types";
import Dashboard from "./components/Dashboard";
import Uploader from "./components/Uploader";
import CaseRegister from "./components/CaseRegister";
import SheetsViewer from "./components/SheetsViewer";
import CaseDetailModal from "./components/CaseDetailModal";
import { Briefcase, FileText, Landmark, LayoutDashboard, Calendar, Search, Trash, Edit2, CheckCircle2, AlertTriangle, ShieldCheck, Clock, PlusCircle, LogOut } from "lucide-react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "./lib/firebase";
import AuthScreen from "./components/AuthScreen";

export default function App() {
  const [cases, setCases] = useState<LitigationCase[]>([]);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<LitigationCase | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ role: "admin" | "user"; fullName: string } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Subscribe to Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        try {
          const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            setUserProfile({
              role: data.role || "user",
              fullName: data.fullName || firebaseUser.displayName || "Authorized Counsel"
            });
          } else {
            // Default baseline profile
            setUserProfile({
              role: "user",
              fullName: firebaseUser.displayName || "Authorized Counsel"
            });
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          setUserProfile({
            role: "user",
            fullName: firebaseUser.displayName || "Authorized Counsel"
          });
        }
      } else {
        // Check local development/demo bypass as a fallback
        const cachedBypass = localStorage.getItem("mills_counsel_bypass");
        if (cachedBypass) {
          try {
            const parsed = JSON.parse(cachedBypass);
            setCurrentUser(parsed.user);
            setUserProfile(parsed.profile);
          } catch (e) {
            setCurrentUser(null);
            setUserProfile(null);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore synchronizer
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "cases"),
      (snapshot) => {
        const loadedCases: LitigationCase[] = [];
        snapshot.forEach((d) => {
          loadedCases.push(d.data() as LitigationCase);
        });

        // Sort cases by updatedAt desc
        loadedCases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCases(loadedCases);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "cases");
      }
    );
    return () => unsub();
  }, []);

  // One-time startup database checker and initial seeder
  useEffect(() => {
    const checkAndSeed = async () => {
      try {
        const setupDoc = await getDoc(doc(db, "system", "setup"));
        if (!setupDoc.exists()) {
          // If no setup marker is found in the database, do a first-time populate
          for (const c of initialCases) {
            await setDoc(doc(db, "cases", c.id), c);
          }
          await setDoc(doc(db, "system", "setup"), { seeded: true });
        }
      } catch (err) {
        console.error("Failed checking setup or seeding default data:", err);
      }
    };
    checkAndSeed();
  }, []);

  const handleAuthSuccess = (user: any, profile: { role: "admin" | "user"; fullName: string }) => {
    setCurrentUser(user);
    setUserProfile(profile);
  };

  // Filter cases visible to standard users (they see pre-seeded cases and cases they authored)
  const filteredCases = cases.filter((c) => {
    if (!currentUser || !userProfile) return false;
    if (userProfile.role === "admin") return true;
    return !c.createdBy || c.createdBy === "public" || c.createdBy === currentUser.uid;
  });

  // Merge & Master Database alignment logic powered by Firebase
  const handleCommitCase = async (newCase: LitigationCase, updatedExisting: boolean) => {
    let finalCase = {
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
      await setDoc(doc(db, "cases", finalCase.id), finalCase);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `cases/${finalCase.id}`);
    }
  };

  const handleAddCaseManual = async (manualCase: LitigationCase) => {
    try {
      const finalCase = {
        ...manualCase,
        createdBy: currentUser?.uid || "public",
        createdByEmail: currentUser?.email || "system@niagaramills.com"
      };
      await setDoc(doc(db, "cases", finalCase.id), finalCase);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `cases/${manualCase.id}`);
    }
  };

  const handleImportMasterCases = async (importedList: LitigationCase[], isMerge: boolean) => {
    if (isMerge) {
      for (const newCase of importedList) {
        let finalCase = {
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
          await setDoc(doc(db, "cases", finalCase.id), finalCase);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `cases/${finalCase.id}`);
        }
      }
    } else {
      // Clear current cases
      try {
        await setDoc(doc(db, "system", "setup"), { seeded: true });
        const idsToClear = cases.map(c => c.id);
        await Promise.all(
          idsToClear.map(id => deleteDoc(doc(db, "cases", id)))
        );
        // Import fresh list
        for (const c of importedList) {
          const withUser = {
            ...c,
            createdBy: currentUser?.uid || "public",
            createdByEmail: currentUser?.email || "system@niagaramills.com"
          };
          await setDoc(doc(db, "cases", c.id), withUser);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "cases");
      }
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (confirm(`Are you sure you want to expunge Litigation Dossier ${caseId} from master database? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "cases", caseId));
        alert(`Litigation Dossier ${caseId} was deleted successfully from the database.`);
      } catch (error) {
        alert(`Failed to delete Litigation Dossier ${caseId}. Please ensure you are online and try again.`);
        console.error("Delete Error:", error);
      }
    }
  };

  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to completely expunge ALL litigation dossiers and wipe the entire database? This action is permanent and cannot be undone.")) {
      try {
        await setDoc(doc(db, "system", "setup"), { seeded: true });
        const idsToDelete = cases.map(c => c.id);
        await Promise.all(
          idsToDelete.map(id => deleteDoc(doc(db, "cases", id)))
        );
        setCases([]);
        alert("The entire database was wiped successfully.");
      } catch (error) {
        alert("Failed to wipe database records. Please try again.");
        console.error("Wipe Error:", error);
      }
    }
  };

  const handleLoadDemoData = async () => {
    try {
      // First save setup document to declare we are seeding/actively managing
      await setDoc(doc(db, "system", "setup"), { seeded: true });
      // Bulk write standard cases
      for (const c of initialCases) {
        await setDoc(doc(db, "cases", c.id), c);
      }
      alert("Demonstration cases populated successfully into your database.");
    } catch (error) {
      alert("Failed to populate demonstration cases. Please try again.");
      console.error("Seed Error:", error);
    }
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
      await setDoc(doc(db, "cases", finalCase.id), finalCase);
      setEditingCase(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `cases/${finalCase.id}`);
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
                      userProfile.role === "admin"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                    }`}>
                      {userProfile.role === "admin" ? "Admin" : "Standard"}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono leading-none mt-0.5 max-w-[155px] truncate">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Sign out of current tax litigation session?")) {
                      localStorage.removeItem("mills_counsel_bypass");
                      await signOut(auth);
                      setCurrentUser(null);
                      setUserProfile(null);
                    }
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

          <div className="mt-auto border-t border-slate-800/80 pt-4 px-3 space-y-2 mt-8">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Enterprise Target</span>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/70 space-y-1 text-center shadow-3xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Controversy Audited</span>
              <span className="text-sm font-extrabold block text-amber-400">
                PKR {(filteredCases.reduce((sum, c) => sum + (c.financialInfo.totalExposure || 0), 0) / 10000000).toFixed(2)} Cr
              </span>
            </div>
            
            {userProfile?.role === "admin" && (
              <button
                onClick={handleClearAllData}
                className="w-full mt-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
                title="Delete all data from the litigation database permanently"
              >
                <Trash size={12} />
                Wipe Database Records
              </button>
            )}

            {userProfile?.role === "admin" && filteredCases.length === 0 && (
              <button
                onClick={handleLoadDemoData}
                className="w-full mt-2 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer animate-pulse"
                title="Populate the database with default demonstration tax litigation folders"
              >
                <PlusCircle size={12} />
                Load Demo Cases
              </button>
            )}
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

    </div>
  );
}
