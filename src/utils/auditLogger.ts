export interface UserActionLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  actionType: string; // "LOGIN" | "LOGOUT" | "DOSSIER_CREATE" | "DOSSIER_UPDATE" | "DOSSIER_DELETE" | "BULK_DELETE" | "BULK_STATUS" | "CLEARANCE_UPDATE" | "RIGHTS_UPDATE" | "WIPE_RECORDS" | "SEED_DEMO" | "USER_CREATE" | "USER_DELETE"
  details: string;
}

const listeners = new Set<() => void>();
const emitLogChange = () => listeners.forEach((l) => l());

export function getActionLogs(): UserActionLog[] {
  try {
    const raw = localStorage.getItem("mills_integrity_logs");
    if (!raw) {
      // Seed some initial demo logs as historical audit trial
      const seedLogs: UserActionLog[] = [
        {
          id: "log-seed-1",
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hours ago
          userId: "owner-uid",
          userEmail: "owner@niagaramills.com",
          userName: "Suleman Mills (Owner)",
          role: "owner",
          actionType: "LOGIN",
          details: "Owner credentials validated. Portal security session initialized from IP 192.168.10.45."
        },
        {
          id: "log-seed-2",
          timestamp: new Date(Date.now() - 3600000 * 23).toISOString(), // 23 hours ago
          userId: "owner-uid",
          userEmail: "owner@niagaramills.com",
          userName: "Suleman Mills (Owner)",
          role: "owner",
          actionType: "SEED_DEMO",
          details: "Seeded 4 default controversy dossiers into the primary litigation registers."
        },
        {
          id: "log-seed-3",
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
          userId: "admin-uid",
          userEmail: "admin@niagaramills.com",
          userName: "Barrister Ali (Admin)",
          role: "admin",
          actionType: "LOGIN",
          details: "Administrator session established. Local clearance key validated."
        },
        {
          id: "log-seed-4",
          timestamp: new Date(Date.now() - 3600000 * 11).toISOString(), // 11 hours ago
          userId: "admin-uid",
          userEmail: "admin@niagaramills.com",
          userName: "Barrister Ali (Admin)",
          role: "admin",
          actionType: "DOSSIER_UPDATE",
          details: "Modified tax exposure calculations for disputed sales audit. (Reference: PRA-SCN-2023/1082)."
        }
      ];
      try {
        localStorage.setItem("mills_integrity_logs", JSON.stringify(seedLogs));
      } catch {}
      return seedLogs;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn("localStorage log reading blocked:", err);
    return [];
  }
}

export function logAction(
  user: { uid: string; email: string } | null,
  profile: { fullName: string; role: string } | null,
  actionType: string,
  details: string
): UserActionLog | null {
  if (!user || !profile) return null;

  const newLog: UserActionLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    userId: user.uid,
    userEmail: user.email,
    userName: profile.fullName,
    role: profile.role,
    actionType,
    details
  };

  try {
    const logs = getActionLogs();
    logs.unshift(newLog); // Put new logs at the beginning
    // Keep maximum 1000 logs for memory protection
    const trimmed = logs.slice(0, 1000);
    localStorage.setItem("mills_integrity_logs", JSON.stringify(trimmed));
    emitLogChange();
    return newLog;
  } catch (err) {
    console.warn("localStorage log writing blocked:", err);
    return null;
  }
}

export function clearActionLogs(): void {
  try {
    localStorage.setItem("mills_integrity_logs", JSON.stringify([]));
    emitLogChange();
  } catch (err) {
    console.warn("localStorage log clearing blocked:", err);
  }
}

export function subscribeToLogs(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
