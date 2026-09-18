"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeDto } from "@rentbrown/types";
import { Alert, Card, Spinner } from "@rentbrown/ui";
import { api, errorCode } from "./api";
import { useSession } from "./auth";

const MeContext = createContext<{
  me: MeDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
}>({ me: null, loading: true, refresh: async () => {} });

/**
 * MeProvider — fetches /v1/users/me once per session and caches it in
 * context. ACCOUNT_DISABLED renders a blocked screen — details stay
 * server-side.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
      setBlocked(null);
    } catch (err) {
      const code = errorCode(err);
      if (code === "ACCOUNT_DISABLED") setBlocked("This admin account is not currently active.");
      else if (code === "FORBIDDEN" || code === "UNAUTHORIZED")
        setBlocked("This account does not have console access.");
      else throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh().catch(() => setLoading(false));
  }, [session, sessionLoading, refresh]);

  if (blocked) {
    return (
      <div className="rb-shell" style={{ maxWidth: 480, paddingTop: 120 }}>
        <Card>
          <Alert variant="error">{blocked} Contact a super admin for help.</Alert>
        </Card>
      </div>
    );
  }

  return (
    <MeContext.Provider value={{ me, loading: loading || sessionLoading, refresh }}>
      {loading && session ? (
        <div
          className="rb-shell"
          style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
        >
          <Spinner label="Loading console" />
        </div>
      ) : (
        children
      )}
    </MeContext.Provider>
  );
}

export function useMe() {
  return useContext(MeContext);
}
