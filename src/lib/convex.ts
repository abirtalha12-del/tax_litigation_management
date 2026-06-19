import React, { useState, useEffect } from "react";
import { ConvexReactClient, ConvexProvider, useQuery as useRealQuery, useMutation as useRealMutation } from "convex/react";
import { initialCases } from "../mockData";

// Retrieve the Convex URL from Vite environment variables
const convexUrl = ((import.meta as any).env?.VITE_CONVEX_URL as string) || "";

// Initialize standard Convex React Client, guarding it with check to prevent crashes if URL is empty
export const convexClient = convexUrl.trim() ? new ConvexReactClient(convexUrl) : null;

// Dynamic provider component to wrap React tree with ConvexProvider when live connection is present
export function ConvexAppProvider({ children }: { children: React.ReactNode }) {
  if (convexClient) {
    return React.createElement(ConvexProvider, { client: convexClient }, children);
  }
  return React.createElement(React.Fragment, null, children);
}

// Reactive state listeners for our offline development bypass / fallback mode
const listeners = new Set<() => void>();
const emitChange = () => listeners.forEach((l) => l());

// Helper getters/setters for persistent fallback operations
const getLocalCases = () => {
  try {
    const raw = localStorage.getItem("mills_counsel_cases");
    if (!raw) {
      try {
        localStorage.setItem("mills_counsel_cases", JSON.stringify(initialCases));
      } catch (e) {}
      return initialCases;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return initialCases;
    }
  } catch (err) {
    console.warn("localStorage read blocked in sandbox:", err);
    return initialCases;
  }
};

const setLocalCases = (cases: any[]) => {
  try {
    localStorage.setItem("mills_counsel_cases", JSON.stringify(cases));
  } catch (err) {
    console.warn("localStorage write blocked in sandbox:", err);
  }
  emitChange();
};

const getLocalUsers = () => {
  try {
    const raw = localStorage.getItem("mills_counsel_users");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("localStorage load users blocked:", err);
    return [];
  }
};

const setLocalUsers = (users: any[]) => {
  try {
    localStorage.setItem("mills_counsel_users", JSON.stringify(users));
  } catch (err) {
    console.warn("localStorage save users blocked:", err);
  }
  emitChange();
};

// Target resolver mapping based on arguments to robust client-side storage endpoints
function resolveLocalQuery(targetApi: any, args: any) {
  const apiPath = getStableApiPath(targetApi);
  if (apiPath && apiPath.includes("getAllUsers")) {
    return getLocalUsers();
  }

  // If we have query arguments containing uid, resolve to user profile
  if (args && args.uid !== undefined) {
    const uid = args.uid;
    if (!uid) return null;

    // Check direct local bypass profile session first
    let bypassStr = null;
    try {
      bypassStr = localStorage.getItem("mills_counsel_bypass");
    } catch {}
    if (bypassStr) {
      try {
        const parsed = JSON.parse(bypassStr);
        if (parsed.user?.uid === uid) {
          const localUsrs = getLocalUsers();
          const targetLocal = localUsrs.find((u: any) => u.uid === uid);
          return {
            uid: parsed.user.uid,
            email: parsed.user.email,
            fullName: parsed.profile.fullName,
            role: parsed.profile.role,
            createdAt: new Date().toISOString(),
            rights: targetLocal?.rights || parsed.profile.rights || undefined,
          };
        }
      } catch {}
    }

    const localUsers = getLocalUsers();
    return localUsers.find((u: any) => u.uid === uid) || null;
  }

  // Default query in sandbox mode returns standard litigation case collection list
  return getLocalCases();
}

// Helper to safely resolve a primitive string from a potential Convex API / Proxy reference
function getStableApiPath(targetApi: any): string {
  if (!targetApi) return "";
  if (typeof targetApi === "string") return targetApi;
  if (typeof targetApi === "object") {
    try {
      const pathValue = targetApi._path;
      if (typeof pathValue === "string") {
        return pathValue;
      }
    } catch {}
    try {
      const nameValue = targetApi.name;
      if (typeof nameValue === "string") {
        return nameValue;
      }
    } catch {}
    try {
      const strVal = String(targetApi);
      if (typeof strVal === "string" && !strVal.includes("[object Object]")) {
        return strVal;
      }
    } catch {}
  }
  return "api";
}

/**
 * Robust useQuery Hook that connects with the Convex server-side backend if configured,
 * or drops back to client-side react state bound to localStorage for immediate previews.
 */
export function useQuery(targetApi: any, args?: any): any {
  if (convexClient) {
    return useRealQuery(targetApi, args);
  }

  // Local sandbox mode reactivity
  const [data, setData] = useState(() => resolveLocalQuery(targetApi, args));

  // Determine a stable key from the dynamic API reference and args
  const apiPath = getStableApiPath(targetApi);
  const argsString = JSON.stringify(args || {});

  useEffect(() => {
    const handleUpdate = () => {
      const nextData = resolveLocalQuery(targetApi, args);
      setData((prevData: any) => {
        // Double-guard to completely prevent infinite render loops:
        // Only trigger React state update if the actual data structure changes.
        if (JSON.stringify(prevData) === JSON.stringify(nextData)) {
          return prevData;
        }
        return nextData;
      });
    };

    listeners.add(handleUpdate);
    // Refresh immediately to keep up-to-date
    handleUpdate();

    return () => {
      listeners.delete(handleUpdate);
    };
  }, [apiPath, argsString]);

  return data;
}

/**
 * Robust useMutation Hook matching standard Convex signature,
 * seamlessly delegating between Convex DB cloud writes or localStorage mutations.
 */
export function useMutation(targetApi: any): (args: any) => Promise<any> {
  if (convexClient) {
    return useRealMutation(targetApi);
  }

  // React-backed mutations operating on local cached replicas
  return async (args: any) => {
    const apiPath = getStableApiPath(targetApi);
    if (apiPath && (apiPath.includes("updateUserRights") || apiPath.includes("users:updateUserRights"))) {
      const usersList = getLocalUsers();
      const existingIdx = usersList.findIndex((u: any) => u.uid === args.uid);
      if (existingIdx > -1) {
        usersList[existingIdx] = {
          ...usersList[existingIdx],
          rights: args.rights
        };
        setLocalUsers(usersList);
      }
      return args.uid;
    }

    // Identify profile mutations (creating or patcing users - args has uid and we don't have caseInfo)
    const isProfile = args && args.uid !== undefined && args.caseInfo === undefined;

    if (isProfile) {
      const usersList = getLocalUsers();
      const existingIdx = usersList.findIndex((u: any) => u.uid === args.uid);
      if (existingIdx > -1) {
        usersList[existingIdx] = { ...usersList[existingIdx], ...args };
      } else {
        usersList.push(args);
      }
      setLocalUsers(usersList);
      return args.uid;
    }

    // Identify case deletion actions (only has single key 'id')
    const isDeletion = args && args.id && Object.keys(args).length === 1;

    if (isDeletion) {
      const casesList = getLocalCases();
      const filtered = casesList.filter((c: any) => c.id !== args.id);
      setLocalCases(filtered);
      return args.id;
    }

    // Identify case insertion and update actions (args has litigation case fields)
    const casesList = getLocalCases();
    const existingIdx = casesList.findIndex((c: any) => c.id === args.id);
    const itemData = {
      ...args,
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx > -1) {
      casesList[existingIdx] = { ...casesList[existingIdx], ...itemData };
    } else {
      casesList.push(itemData);
    }
    setLocalCases(casesList);
    return args.id;
  };
}
