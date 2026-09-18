"use client";

import type { ReactNode } from "react";
import { MeProvider } from "@/lib/me";
import { RequireAuth } from "@/lib/auth";

/** protected application shell — session + internal user required */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <MeProvider>{children}</MeProvider>
    </RequireAuth>
  );
}
