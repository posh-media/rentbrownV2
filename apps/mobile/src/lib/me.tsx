import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeDto } from "@rentbrown/types";
import { api, errorCode } from "./api";
import { useSession } from "./session";

const MeContext = createContext<{
  me: MeDto | null;
  loading: boolean;
  disabled: boolean;
  refresh: () => Promise<void>;
}>({ me: null, loading: true, disabled: false, refresh: async () => {} });

/** fetches /v1/users/me once per session; refresh() after mutations */
export function MeProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
      setDisabled(false);
    } catch (err) {
      if (errorCode(err) === "ACCOUNT_DISABLED") setDisabled(true);
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

  return (
    <MeContext.Provider value={{ me, loading: loading || sessionLoading, disabled, refresh }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe() {
  return useContext(MeContext);
}
