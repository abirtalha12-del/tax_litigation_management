import React, { useState, useMemo } from "react";
import { 
  Activity, 
  Search, 
  Download, 
  Trash2, 
  User, 
  ShieldAlert, 
  Calendar, 
  SlidersHorizontal,
  AlertTriangle
} from "lucide-react";
import { UserActionLog } from "../utils/auditLogger";

interface LogsPanelProps {
  logs: UserActionLog[];
  userRole: "owner" | "admin" | "user";
  onClearLogs: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>, description?: string) => void;
}

export default function LogsPanel({
  logs,
  userRole,
  onClearLogs,
  showToast,
  showConfirm
}: LogsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");

  // Filter types list
  const logTypes = useMemo(() => {
    const list = new Set(logs.map((log) => log.actionType));
    return ["ALL", ...Array.from(list)];
  }, [logs]);

  // Filter users list
  const logUsers = useMemo(() => {
    const map = new Map<string, string>(); // userEmail -> userName
    logs.forEach((log) => {
      if (log.userEmail) {
        map.set(log.userEmail, log.userName);
      }
    });
    return Array.from(map.entries());
  }, [logs]);

  // Apply search & filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search text match
      const searchString = `${log.userName} ${log.userEmail} ${log.details} ${log.actionType}`.toLowerCase();
      const matchesSearch = searchString.includes(searchTerm.toLowerCase());

      // Action type match
      const matchesType = selectedType === "ALL" || log.actionType === selectedType;

      // User match
      const matchesUser = selectedUser === "ALL" || log.userEmail === selectedUser;

      return matchesSearch && matchesType && matchesUser;
    });
  }, [logs, searchTerm, selectedType, selectedUser]);

  // Export action handler
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast("There are no filtered integrity logs loaded for download.", "error");
      return;
    }

    try {
      const headers = ["ID", "UTC Timestamp", "Full Name", "Corporate Email", "Clearance Level", "Action Type", "Transcript Details"];
      const rows = filteredLogs.map(log => [
        log.id,
        log.timestamp,
        log.userName.replace(/"/g, '""'),
        log.userEmail,
        log.role.toUpperCase(),
        log.actionType,
        log.details.replace(/"/g, '""')
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Mills_Counsel_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Audit trail registry successfully downloaded as CSV format.", "success");
    } catch (e) {
      showToast("Failed to compile CSV payload. Please retry.", "error");
    }
  };

  const handleTriggerClearLogs = () => {
    if (userRole !== "owner") {
      showToast("Clearance Denied. Wiping system integrity logs requires direct primary Owner authorization.", "error");
      return;
    }

    showConfirm(
      "Expunge All System Action Logs?",
      () => {
        onClearLogs();
        showToast("System integrity action audit trail cleared successfully.", "success");
      },
      "WARNING: This will instantly and permanently erase the sequence of activity tracking inside the portal. Secure historical record sequence will be destroyed."
    );
  };

  // Helper styling for Action Category tags
  const getBadgeColorClasses = (type: string) => {
    switch (type) {
      case "LOGIN":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "LOGOUT":
        return "bg-slate-500/15 text-slate-400 border-slate-500/20";
      case "DOSSIER_CREATE":
        return "bg-emerald-500/10 text-emerald-405 border-emerald-500/20";
      case "DOSSIER_UPDATE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "DOSSIER_DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "BULK_DELETE":
        return "bg-rose-600/15 text-rose-300 border-rose-500/30";
      case "BULK_STATUS":
        return "bg-cyan-500/10 text-cyan-405 border-cyan-500/20";
      case "CLEARANCE_UPDATE":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "RIGHTS_UPDATE":
        return "bg-violet-500/10 text-violet-400 border-violet-500/20";
      case "WIPE_RECORDS":
        return "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse";
      case "SEED_DEMO":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "USER_CREATE":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "USER_DELETE":
        return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      default:
        return "bg-slate-700/10 text-slate-400 border-slate-700/20";
    }
  };

  // Human-friendly date visualizer
  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0" id="logs-panel-view">
      
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#090d16] p-6 rounded-2xl border border-slate-800/80">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 font-mono flex items-center gap-1.5 mb-1">
            <Activity className="animate-pulse" size={13} />
            Security Compliance Cockpit
          </span>
          <h2 className="text-xl font-bold tracking-tight text-white">System Integrity Audit Logs</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Real-time, cryptographically aligned local audit trails detailing login sessions, database record manipulation, and credential clearance modifications.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            title="Download formatted CSV records"
          >
            <Download size={14} />
            Export CSV
          </button>

          {userRole === "owner" ? (
            <button
              onClick={handleTriggerClearLogs}
              className="flex-1 sm:flex-initial bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-450 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              title="Void complete local logger archive"
            >
              <Trash2 size={14} />
              Clear Audit Trail
            </button>
          ) : (
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900 text-[10px] text-slate-500 font-mono leading-tight flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-slate-600 shrink-0" />
              <span>Logging clearance level: L3 Counsel archive-only</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Filter Matrix bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950/45 p-4 rounded-xl border border-slate-900">
        
        {/* Search */}
        <div className="md:col-span-6 relative">
          <Search className="absolute left-3 top-3.5 text-slate-550 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="Search action details, emails, operator, log ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition"
          />
        </div>

        {/* Action Type Filter */}
        <div className="md:col-span-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 text-slate-305 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="ALL">All Action Events</option>
            {logTypes.filter(t => t !== "ALL").map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Operator User Filter */}
        <div className="md:col-span-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 text-slate-305 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="ALL">All Operators</option>
            {logUsers.map(([email, name]) => (
              <option key={email} value={email}>{name} ({email})</option>
            ))}
          </select>
        </div>

      </div>

      {/* Main Audit Listing */}
      <div className="bg-[#040810] rounded-xl border border-slate-850 overflow-hidden flex flex-col flex-1 min-h-[300px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#090d16] border-b border-slate-805 text-[10px] text-slate-450 uppercase tracking-widest font-mono">
                <th className="py-4 px-5">Timestamp (UTC)</th>
                <th className="py-4 px-4">Operator Name / Clearance</th>
                <th className="py-4 px-4">Action Event</th>
                <th className="py-4 px-5">Detailed Transcript Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-550 font-sans">
                    <SlidersHorizontal className="mx-auto mb-3 text-slate-700 animate-pulse" size={32} />
                    <p className="text-sm font-bold text-slate-400">No Security Logs Recorded</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                      No logs matching the selected parameter matrix were located inside the local integrity ledger cache database.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-900/30 transition-colors text-xs">
                      
                      {/* Timestamp */}
                      <td className="py-3.5 px-5 select-all text-slate-450 font-mono text-[10.5px] leading-relaxed shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-600 shrink-0" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Operator User */}
                      <td className="py-3.5 px-4 shrink-0">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-205 flex items-center gap-1">
                            <User size={12} className="text-slate-500 shrink-0" />
                            {log.userName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono leading-none mt-0.5 truncate max-w-[190px]">
                            {log.userEmail}
                          </span>
                        </div>
                      </td>

                      {/* Action Event Type Code Badge */}
                      <td className="py-3.5 px-4 shrink-0 select-all">
                        <span className={`inline-block px-2.5 py-1 text-[10px] tracking-wide font-extrabold uppercase font-mono rounded border ${getBadgeColorClasses(log.actionType)}`}>
                          {log.actionType}
                        </span>
                      </td>

                      {/* Detailed Transcript Transcript */}
                      <td className="py-3.5 px-5 text-slate-350 select-all font-sans leading-normal">
                        <p className="whitespace-normal max-w-md break-words">{log.details}</p>
                        <span className="text-[9px] text-slate-650 font-mono tracking-wider block mt-1">
                          AUDIT KEY: {log.id}
                        </span>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Count Footer */}
        <div className="bg-[#060a12] p-4 text-slate-500 text-[10.5px] font-mono border-t border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Auditing Connection Status: Online & Sealed Securely</span>
          </div>
          <span>Fetched {filteredLogs.length} of {logs.length} Total Audit Ledger Rows</span>
        </div>

      </div>

    </div>
  );
}
