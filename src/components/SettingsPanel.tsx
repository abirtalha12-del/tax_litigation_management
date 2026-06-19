import React, { useState, useEffect } from "react";
import { 
  Users, 
  ShieldAlert, 
  UserPlus, 
  Trash2, 
  Key, 
  Sliders, 
  CheckCircle, 
  Lock, 
  UserCheck, 
  Database,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { useMutation, convexClient } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { LitigationCase, getDefaultRights } from "../types";
import { logAction } from "../utils/auditLogger";


interface SettingsPanelProps {
  currentUser: { email: string; uid: string };
  userProfile: { role: "owner" | "admin" | "user"; fullName: string; rights?: any };
  onProfileUpdate: (profile: { role: "owner" | "admin" | "user"; fullName: string; rights?: any }) => void;
  onWipeDatabase: () => Promise<void>;
  onLoadDemo: () => Promise<void>;
  casesCount: number;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>, description?: string) => void;
}

interface WebAccount {
  uid: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "user";
  password?: string;
  createdAt?: string;
}

export default function SettingsPanel({
  currentUser,
  userProfile,
  onProfileUpdate,
  onWipeDatabase,
  onLoadDemo,
  casesCount,
  showToast,
  showConfirm
}: SettingsPanelProps) {
  // Local active users from localStorage
  const [accounts, setAccounts] = useState<WebAccount[]>([]);
  // Form state to add new users
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"owner" | "admin" | "user">("user");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Self account edit form state
  const [selfName, setSelfName] = useState(userProfile.fullName);
  const [selfPassword, setSelfPassword] = useState("");
  const [selfSuccess, setSelfSuccess] = useState<string | null>(null);

  // Selected user for custom rights and checkbox states
  const [selectedUid, setSelectedUid] = useState<string>("");
  const [rightsCanCreate, setRightsCanCreate] = useState(true);
  const [rightsCanEdit, setRightsCanEdit] = useState(true);
  const [rightsCanDelete, setRightsCanDelete] = useState(false);
  const [rightsCanExport, setRightsCanExport] = useState(true);
  const [rightsCanWipe, setRightsCanWipe] = useState(false);

  // Convex mutation hook
  const doUpdateRights = useMutation(api.users.updateUserRights);

  useEffect(() => {
    if (!selectedUid) return;
    const target = accounts.find((a) => a.uid === selectedUid);
    if (target) {
      const currentRights = target.rights || getDefaultRights(target.role);
      setRightsCanCreate(currentRights.canCreateDossier);
      setRightsCanEdit(currentRights.canEditDossier);
      setRightsCanDelete(currentRights.canDeleteDossier);
      setRightsCanExport(currentRights.canExportReports);
      setRightsCanWipe(currentRights.canWipeDatabase);
    }
  }, [selectedUid, accounts]);


  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    try {
      const raw = localStorage.getItem("mills_counsel_accounts");
      const defaults = [
        { uid: "owner-uid", email: "owner@niagaramills.com", password: "Sayyedtalha123", fullName: "Suleman Mills (Owner)", role: "owner" },
        { uid: "admin-uid", email: "admin@niagaramills.com", password: "password", fullName: "Barrister Ali (Admin)", role: "admin" },
        { uid: "counsel-uid", email: "counsel@niagaramills.com", password: "password", fullName: "Advocate Bilal", role: "user" }
      ];

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
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
            setAccounts(parsed);
          } else {
            setAccounts(defaults);
          }
        } catch {
          setAccounts(defaults);
        }
      } else {
        setAccounts(defaults);
      }
    } catch (err) {
      console.warn("localStorage accounts load blocked:", err);
      const defaults = [
        { uid: "owner-uid", email: "owner@niagaramills.com", password: "Sayyedtalha123", fullName: "Suleman Mills (Owner)", role: "owner" },
        { uid: "admin-uid", email: "admin@niagaramills.com", password: "password", fullName: "Barrister Ali (Admin)", role: "admin" },
        { uid: "counsel-uid", email: "counsel@niagaramills.com", password: "password", fullName: "Advocate Bilal", role: "user" }
      ];
      setAccounts(defaults);
    }
  };

  const saveAccountsToStorage = (updatedList: WebAccount[]) => {
    try {
      localStorage.setItem("mills_counsel_accounts", JSON.stringify(updatedList));
    } catch (err) {
      console.warn("localStorage accounts write blocked:", err);
    }
    setAccounts(updatedList);
  };

  // Change user clearance
  const handleChangeRole = (userId: string, targetRole: "owner" | "admin" | "user") => {
    if (userProfile.role !== "owner") {
      showToast("Only the Owner has permission to lift, revoke, or modify system clearance levels.", "error");
      return;
    }

    const targetUser = accounts.find(a => a.uid === userId);
    if (!targetUser) return;

    const performRoleChange = () => {
      const updated = accounts.map((acc) => {
        if (acc.uid === userId) {
          return { ...acc, role: targetRole };
        }
        return acc;
      });

      saveAccountsToStorage(updated);
      logAction(
        currentUser,
        userProfile,
        "CLEARANCE_UPDATE",
        `Clearance role for user '${targetUser.fullName}' (Email: ${targetUser.email}) modified to [${targetRole.toUpperCase()}].`
      );

      // If changing own profile, sync state with parent
      if (userId === currentUser.uid) {
        onProfileUpdate({ ...userProfile, role: targetRole });
        try {
          const stored = sessionStorage.getItem("mills_logged_in_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.profile.role = targetRole;
            sessionStorage.setItem("mills_logged_in_user", JSON.stringify(parsed));
          }
        } catch (err) {
          console.warn("sessionStorage role update failed in sandboxed mode:", err);
        }
      }
      showToast(`Clearance for ${targetUser.fullName} updated to ${targetRole}.`, "success");
    };

    if (userId === currentUser.uid && targetRole !== "owner") {
      showConfirm(
        "Demote yourself from Owner?",
        performRoleChange,
        "You will instantly lose access to delete records, void counsel access seals, and wipe databases."
      );
    } else {
      performRoleChange();
    }
  };

  // Save the custom user rights decisions
  const handleSaveRights = async () => {
    if (userProfile.role !== "owner") {
      showToast("Only the Owner has permission to modify detailed user rights.", "error");
      return;
    }

    if (!selectedUid) {
      showToast("Please select a counsel member to modify rights.", "error");
      return;
    }

    const targetUser = accounts.find(a => a.uid === selectedUid);
    if (!targetUser) return;

    const rightsPayload = {
      canCreateDossier: rightsCanCreate,
      canEditDossier: rightsCanEdit,
      canDeleteDossier: rightsCanDelete,
      canExportReports: rightsCanExport,
      canWipeDatabase: rightsCanWipe,
    };

    const updated = accounts.map((acc) => {
      if (acc.uid === selectedUid) {
        return { ...acc, rights: rightsPayload };
      }
      return acc;
    });

    saveAccountsToStorage(updated);
    logAction(
      currentUser,
      userProfile,
      "RIGHTS_UPDATE",
      `Dynamic security clearance privileges updated for counsel: ${targetUser.fullName} (Email: ${targetUser.email}).`
    );

    // Sync state with parent if editing ourselves
    if (selectedUid === currentUser.uid) {
      onProfileUpdate({ ...userProfile, rights: rightsPayload });
      try {
        const stored = sessionStorage.getItem("mills_logged_in_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.profile.rights = rightsPayload;
          sessionStorage.setItem("mills_logged_in_user", JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn("sessionStorage rights save failed in sandboxed mode:", err);
      }
    }

    // Call Convex dynamic mutation if live client exists
    try {
      if (convexClient) {
        await doUpdateRights({
          uid: selectedUid,
          rights: rightsPayload
        });
      }
    } catch (err) {
      console.warn("Convex rights mutation failed:", err);
    }

    showToast(`Access rights decision successfully saved for ${targetUser.fullName}.`, "success");
  };

  // Handle direct creation of new counsels/accounts
  const handleCreateUserDirectly = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    if (userProfile.role !== "owner" && userProfile.role !== "admin") {
      setAddError("Clearance Denied. Creating new users requires administrator authorization.");
      return;
    }

    if (!newFullName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setAddError("Please fill in all authorized counsel parameters.");
      return;
    }

    // Check email clash
    const emailLower = newEmail.trim().toLowerCase();
    const clash = accounts.find((a) => a.email.toLowerCase() === emailLower);
    if (clash) {
      setAddError("An account with this corporate email address is already sealed.");
      return;
    }

    const generatedUid = `direct-uid-${Date.now()}`;
    const newUser: WebAccount = {
      uid: generatedUid,
      fullName: newFullName.trim(),
      email: emailLower,
      password: newPassword,
      role: newRole,
      createdAt: new Date().toISOString()
    };

    const updatedList = [...accounts, newUser];
    saveAccountsToStorage(updatedList);
    logAction(
      currentUser,
      userProfile,
      "USER_CREATE",
      `Authorized and generated a brand new security access level slot for user '${newUser.fullName}' (Email: ${newUser.email}, Clearance: ${newUser.role.toUpperCase()}).`
    );

    setAddSuccess(`Counsel Seal successfully generated for: ${newUser.fullName}`);
    showToast(`Counsel Seal generated for ${newUser.fullName}`, "success");
    setNewFullName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("user");
  };

  // Delete counsel account
  const handleDeleteAccount = (userId: string) => {
    if (userProfile.role !== "owner" && userProfile.role !== "admin") {
      showToast("Clearance Denied. Only authorized administrators can void counsel access seals.", "error");
      return;
    }

    if (userId === currentUser.uid) {
      showToast("You cannot remove your own active owner security seal. Please log into another administrative account first.", "error");
      return;
    }

    const target = accounts.find(a => a.uid === userId);
    if (!target) return;

    if (target.role === "owner" && userProfile.role !== "owner") {
      showToast("Clearance Denied. Alternate administrators cannot void the Owner's security seal.", "error");
      return;
    }

    showConfirm(
      `Void access seal for ${target.fullName}?`,
      () => {
        const updated = accounts.filter(a => a.uid !== userId);
        saveAccountsToStorage(updated);
        logAction(
          currentUser,
          userProfile,
          "USER_DELETE",
          `Permanently voided the credentials and access seal of user: ${target.fullName} (${target.email}, Role: ${target.role.toUpperCase()}).`
        );
        showToast(`Access seal for ${target.fullName} has been voided.`, "success");
      },
      "That user will immediately lose access to the tax controversy portal."
    );
  };

  // Modify self credentials
  const handleUpdateSelfProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfSuccess(null);

    if (!selfName.trim()) {
      showToast("Name cannot be empty.", "error");
      return;
    }

    const updated = accounts.map((acc) => {
      if (acc.uid === currentUser.uid) {
        const next: WebAccount = { ...acc, fullName: selfName.trim() };
        if (selfPassword.trim()) {
          next.password = selfPassword;
        }
        return next;
      }
      return acc;
    });

    saveAccountsToStorage(updated);

    // Sync app level
    onProfileUpdate({ ...userProfile, fullName: selfName.trim() });
    
    // Sync sessionStorage current user
    try {
      const stored = sessionStorage.getItem("mills_logged_in_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.profile.fullName = selfName.trim();
        sessionStorage.setItem("mills_logged_in_user", JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn("sessionStorage name updates blocked in sandbox:", err);
    }

    setSelfPassword("");
    setSelfSuccess("Your profile details have been securely updated.");
    showToast("Profile details securely updated.", "success");
  };

  const isOwner = userProfile.role === "owner";
  const isAdmin = userProfile.role === "admin";
  const canManageUsers = isOwner || isAdmin;

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      
      {/* Overview Intro banner */}
      <div className="bg-[#0c1626]/40 p-6 rounded-3xl border border-slate-800/80 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-500">
            <Sliders size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500">System Preferences</span>
            <h2 className="text-lg font-bold text-white leading-none mt-1">Clearance & Security Settings</h2>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
          Assign, grant, and inspect roles, corporate credentials, and database safety protocols for Niagara Mills (PVT) Ltd counsel members.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column: Clearance Matrix & User Accounts */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Authorization matrix */}
          <div className="bg-[#090d16] border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-amber-500" size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
                Counsel Authorization & clearance Rights Matrix
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              <div className="bg-[#030712] border border-emerald-500/10 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-widest uppercase">
                    Level 1: Owner
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Master administrative owner of the Mills estate portfolio. Holds exclusive clearance.
                </p>
                <ul className="text-[9px] text-slate-500 space-y-1 font-mono">
                  <li className="text-emerald-500/80">✓ Delete individual records</li>
                  <li className="text-emerald-500/80">✓ Wipe entire litigation DB</li>
                  <li className="text-emerald-500/80">✓ Change user clearance roles</li>
                  <li>✓ Add/Edit cases manually</li>
                  <li>✓ Feed smart tax OCR digests</li>
                </ul>
              </div>

              <div className="bg-[#030712] border border-amber-500/10 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 font-mono tracking-widest uppercase">
                    Level 2: Admin
                  </span>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Assigned counsel director. Authorized to structure and edit case chronologies without deletion rights.
                </p>
                <ul className="text-[9px] text-slate-500 space-y-1 font-mono">
                  <li className="text-rose-500/80">✗ Cannot delete records</li>
                  <li className="text-rose-500/80">✗ Cannot wipe DB records</li>
                  <li>✓ Read all organization folders</li>
                  <li>✓ Create & Edit manual files</li>
                  <li>✓ Feed active OCR digests</li>
                </ul>
              </div>

              <div className="bg-[#030712] border border-indigo-500/10 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-widest uppercase">
                    Level 3: Counsel
                  </span>
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Standard external legal counsel. Restricted to read-only folder structures and basic uploads.
                </p>
                <ul className="text-[9px] text-slate-500 space-y-1 font-mono">
                  <li className="text-rose-500/80">✗ Cannot delete or wipe</li>
                  <li className="text-rose-500/80">✗ User list management restricted</li>
                  <li>✓ Add litigation folder</li>
                  <li>✓ Edit own assigned dossiers</li>
                  <li>✓ Generate DOCX summaries</li>
                </ul>
              </div>

            </div>
          </div>

          {/* User management list */}
          {canManageUsers && (
            <div className="bg-[#090d16] border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="text-indigo-400" size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
                    Registered Portal Counsel ({accounts.length})
                  </h3>
                </div>
                <button 
                  onClick={loadAccounts} 
                  className="p-1 px-2 flex items-center gap-1.5 text-[9px] text-slate-500 hover:text-slate-200 transition bg-slate-900 border border-slate-800 rounded font-mono"
                >
                  <RefreshCw size={10} />
                  Sync List
                </button>
              </div>

              <div className="overflow-x-auto bg-slate-950/50 border border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#050911]/90 border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    <tr>
                      <th className="px-4 py-3">Counsel Name</th>
                      <th className="px-4 py-3">Corporate Email</th>
                      <th className="px-4 py-3">Authorization Clearance</th>
                      <th className="px-4 py-3 text-center">Safety Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {accounts.map((user) => {
                      const isSelf = user.uid === currentUser.uid;
                      return (
                        <tr key={user.uid} className="hover:bg-slate-900/40 transition">
                          {/* Name */}
                          <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{user.fullName}</span>
                              {isSelf && (
                                <span className="text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-sm px-1 py-0.5 uppercase tracking-wide">
                                  Active Self
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Email */}
                          <td className="px-4 py-3 text-slate-400 font-mono">
                            {user.email}
                          </td>
                          {/* Role Dropdown */}
                          <td className="px-4 py-3">
                            {isOwner && !isSelf ? (
                              <select
                                value={user.role}
                                onChange={(e) => handleChangeRole(user.uid, e.target.value as any)}
                                className="bg-slate-900/90 text-xs text-white border border-slate-800 rounded-lg p-1.5 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="owner">Level 1: Owner</option>
                                <option value="admin">Level 2: Admin</option>
                                <option value="user">Level 3: Counsel</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold font-mono uppercase tracking-wide border ${
                                user.role === "owner" 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : user.role === "admin"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              }`}>
                                {user.role === "owner" ? "L1: Owner" : user.role === "admin" ? "L2: Admin" : "L3: Counsel"}
                              </span>
                            )}
                          </td>
                          {/* Delete account */}
                          <td className="px-4 py-3 text-center">
                            {canManageUsers && !isSelf ? (
                              <button
                                onClick={() => handleDeleteAccount(user.uid)}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded transition cursor-pointer"
                                title="Void Counsel Account Security Seal"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-mono italic">
                                {isSelf ? "N/A" : "Admin Only"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[9.5px] text-slate-500 leading-normal font-mono">
                ★ Active security check: Total sealed legal credentials matching this container is {accounts.length}. Changes to role elevations persist instantly to browser sessions.
              </p>
            </div>
          )}

          {/* USER RIGHTS decision form - ONLY visible to OWNER */}
          {userProfile.role === "owner" && (
            <div className="bg-[#090d16] border border-amber-500/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Sliders className="text-amber-400" size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                  Owner Panel: Custom Counsel Rights Decisions
                </h3>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                As the master administrative Owner, you have exclusive authorization to delegate or rescind granular application action rights of any individual counsel.
              </p>

              <div className="space-y-4">
                {/* User selection dropdown */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Choose Counsel to Modify
                  </label>
                  <select
                    value={selectedUid}
                    onChange={(e) => setSelectedUid(e.target.value)}
                    className="w-full bg-[#020617]/70 text-xs text-white border border-slate-800 rounded-lg p-2 focus:outline-hidden focus:ring-1 focus:ring-amber-500 [&>option]:bg-[#0f172a]"
                  >
                    <option value="">-- Click to Select Registered Counsel --</option>
                    {accounts.map((user) => (
                      <option key={user.uid} value={user.uid}>
                        {user.fullName} ({user.email}) [{user.role.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>

                {selectedUid && (
                  <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3 animate-fade-in">
                    <span className="text-[10px] font-bold text-amber-400 font-mono tracking-wider uppercase block">
                      Fine-Tuned Permissions Form
                    </span>

                    <div className="space-y-2 text-xs">
                      {/* 1. canCreateDossier */}
                      <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rightsCanCreate}
                          onChange={(e) => setRightsCanCreate(e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-[#020617] border-slate-800 rounded focus:ring-0 checked:bg-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">Create and Register Dossiers</span>
                          <span className="text-[9.5px] text-slate-500 font-normal leading-tight font-sans">Allow manual adding and filing of taxpayer directories.</span>
                        </div>
                      </label>

                      {/* 2. canEditDossier */}
                      <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none border-t border-slate-900 pt-2 block">
                        <input
                          type="checkbox"
                          checked={rightsCanEdit}
                          onChange={(e) => setRightsCanEdit(e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-[#020617] border-slate-800 rounded focus:ring-0 checked:bg-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">Edit Records and Chronology</span>
                          <span className="text-[9.5px] text-slate-500 font-normal leading-tight font-sans">Allow direct modifications of litigation outcome positioning and timeline events.</span>
                        </div>
                      </label>

                      {/* 3. canDeleteDossier */}
                      <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none border-t border-slate-900 pt-2 block">
                        <input
                          type="checkbox"
                          checked={rightsCanDelete}
                          onChange={(e) => setRightsCanDelete(e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-[#020617] border-slate-800 rounded focus:ring-0 checked:bg-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">Delete and Purge Litigation Dossiers</span>
                          <span className="text-[9.5px] text-slate-500 font-normal leading-tight font-sans text-rose-400/80">Allow permanently expunging dossiers from registers ledger.</span>
                        </div>
                      </label>

                      {/* 4. canExportReports */}
                      <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none border-t border-slate-900 pt-2 block">
                        <input
                          type="checkbox"
                          checked={rightsCanExport}
                          onChange={(e) => setRightsCanExport(e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-[#020617] border-slate-800 rounded focus:ring-0 checked:bg-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">Export Word & Excel summaries</span>
                          <span className="text-[9.5px] text-slate-500 font-normal leading-tight font-sans">Allow downloading court summaries and consolidated spreadsheets.</span>
                        </div>
                      </label>

                      {/* 5. canWipeDatabase */}
                      <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none border-t border-slate-900 pt-2 block">
                        <input
                          type="checkbox"
                          checked={rightsCanWipe}
                          onChange={(e) => setRightsCanWipe(e.target.checked)}
                          className="w-4 h-4 text-amber-500 bg-[#020617] border-slate-800 rounded focus:ring-0 checked:bg-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">Database Reset & Import Wizard</span>
                          <span className="text-[9.5px] text-slate-500 font-normal leading-tight font-sans font-sans text-amber-450/90">Allow loading entire test datasets or triggering complete database voids.</span>
                        </div>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveRights}
                      className="w-full bg-amber-500 hover:bg-amber-450 text-[#090d16] font-bold text-xs py-2 rounded-lg transition duration-200 cursor-pointer shadow-sm text-center font-sans tracking-wide"
                    >
                      Enforce Clearance Rights Decisions
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Direct User Adding & Self Account */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Seal another counsel Directly */}
          {canManageUsers && (
            <div className="bg-[#090d16] border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-white">
                <UserPlus size={15} className="text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                  Seal New Counsel Member
                </h3>
              </div>
              
              <form onSubmit={handleCreateUserDirectly} className="space-y-3">
                
                {addError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-400 font-medium">
                    {addError}
                  </div>
                )}

                {addSuccess && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-[10px] text-emerald-400 font-medium whitespace-pre-wrap">
                    {addSuccess}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    FullName
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g., Barrister Bilal Abbasi"
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@niagaramills.com"
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Initial Clearance Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-hidden"
                  >
                    <option value="user">Level 3: Counsel (Standard)</option>
                    <option value="admin">Level 2: Counsel Admin</option>
                    <option value="owner">Level 1: Company Owner</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle size={12} />
                  Generate Counsel Seal
                </button>

              </form>
            </div>
          )}

          {/* Edit own credentials */}
          <div className="bg-[#090d16] border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white">
              <Key size={15} className="text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                My Secure Locker Key
              </h3>
            </div>
            
            <form onSubmit={handleUpdateSelfProfile} className="space-y-3">
              
              {selfSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-400 font-medium">
                  {selfSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                  Assigned Profile Fullname
                </label>
                <input
                  type="text"
                  required
                  value={selfName}
                  onChange={(e) => setSelfName(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                  Change Access Key (Leave blank to keep)
                </label>
                <input
                  type="password"
                  value={selfPassword}
                  onChange={(e) => setSelfPassword(e.target.value)}
                  placeholder="Change password key..."
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Save Locker Identity
              </button>

            </form>
          </div>

          {/* Safety database wiping desk */}
          <div className="bg-[#0c0d13] border border-rose-950/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Database size={15} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                Locker Database Safety Desk
              </h3>
            </div>

            {isOwner ? (
              <div className="space-y-3 text-left">
                <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={14} />
                  <div className="text-[10px] text-rose-300 leading-normal">
                    <span className="font-bold block uppercase tracking-wide text-rose-400 mb-0.5">Danger Zone Clearance Active</span>
                    As the **Authorized Owner**, only you hold the physical key to wipe cases or force full-scale resets. This action has zero rollback.
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      showConfirm(
                        "Expunge the entire master database?",
                        async () => {
                          await onWipeDatabase();
                        },
                        "CRITICAL WARNING: This will completely and permanently delete all litigation files, tax directories, and controversy events from the main server registry. This cannot be rolled back."
                      );
                    }}
                    className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/25 justify-center font-bold py-2 rounded-xl text-xs flex items-center gap-2 transition duration-200 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Permanent Database Wipe
                  </button>

                  {casesCount === 0 && (
                    <button
                      onClick={onLoadDemo}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/25 justify-center font-bold py-2 rounded-xl text-xs flex items-center gap-2 transition duration-200 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      Repopulate Demo Cases
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-left">
                <div className="flex items-start gap-2">
                  <Lock size={12} className="text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-slate-500 leading-normal font-mono">
                    Owner operations restricted. Wiping the litigation records ledger is locked strictly for Level 1 Owner clearance (<span className="text-slate-400 italic font-bold">owner@niagaramills.com</span>).
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
