"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** proves the API foundation is reachable from the web shell */
export function ApiStatus() {
  const [status, setStatus] = useState<"checking" | "up" | "down">("checking");

  useEffect(() => {
    api
      .health()
      .then(() => setStatus("up"))
      .catch(() => setStatus("down"));
  }, []);

  const color =
    status === "up"
      ? "var(--status-success-fg)"
      : status === "down"
        ? "var(--status-error-fg)"
        : "var(--text-tertiary)";

  return (
    <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
      API status: <strong style={{ color }}>{status}</strong>
    </p>
  );
}
