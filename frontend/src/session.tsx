import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, tokenKey } from "./api";
import type { SessionUser } from "./api";

type SessionValue = {
  user: SessionUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh(): Promise<void> {
    // FIX #11: read from localStorage (survives tab close)
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await api<SessionUser>("/auth/me"));
    } catch {
      localStorage.removeItem(tokenKey);
      setUser(null);
    } finally {
      setReady(true);
    }
  }

  function signOut(): void {
    // FIX #11: clear localStorage
    localStorage.removeItem(tokenKey);
    setUser(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <SessionContext.Provider value={{ user, ready, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
