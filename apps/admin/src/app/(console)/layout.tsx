"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, Button } from "@rentbrown/ui";
import { MeProvider, useMe } from "@/lib/me";
import { RequireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const NAV: Array<{ href: string; label: string; permission?: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users", permission: "users.read" },
  { href: "/kyc", label: "KYC", permission: "kyc.read" },
  { href: "/policies", label: "Policies", permission: "policies.read" },
  { href: "/audit", label: "Audit", permission: "audit.read" },
];

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { me } = useMe();
  const perms = new Set(me?.permissions ?? []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        aria-label="Admin navigation"
        style={{
          width: 220,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
          padding: "24px 16px",
          flexShrink: 0,
        }}
      >
        <p className="rb-eyebrow" style={{ margin: "0 0 20px" }}>
          RentBrown Admin
        </p>
        <div className="rb-stack">
          {NAV.filter((n) => !n.permission || perms.has(n.permission)).map((n) => (
            <Link key={n.href} href={n.href} style={{ fontSize: 14, fontWeight: 600 }}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 24px",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <span className="rb-muted" style={{ fontSize: 13 }}>
            {me?.email ?? ""}
            {me?.roles?.length ? (
              <>
                {" "}
                ·{" "}
                {me.roles.map((r) => (
                  <Badge key={r} status={r}>
                    {r}
                  </Badge>
                ))}{" "}
              </>
            ) : null}
          </span>
          <Button
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </header>
        <main style={{ padding: "32px 24px" }}>{children}</main>
      </div>
    </div>
  );
}

/** protected console shell — session + internal user required */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <MeProvider>
        <Shell>{children}</Shell>
      </MeProvider>
    </RequireAuth>
  );
}
