"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, PageHeader } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/me";

export default function DashboardPage() {
  const { me } = useMe();
  const [aal, setAal] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => setAal(data?.currentLevel ?? null))
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader title="Dashboard" subtitle="Operations overview" />
      <div className="rb-stack">
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Session</h2>
          <p className="rb-muted" style={{ fontSize: 14 }}>
            Signed in as {me?.email} — MFA{" "}
            {aal === "aal2" ? (
              <Badge status="ACTIVE">active</Badge>
            ) : (
              <Badge status="RESTRICTED">not elevated</Badge>
            )}
          </p>
        </Card>
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Quick links</h2>
          <div className="rb-row" style={{ fontSize: 14 }}>
            <Link href="/users">Users</Link>
            <Link href="/kyc">KYC cases</Link>
            <Link href="/policies">Policies</Link>
            <Link href="/audit">Audit log</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
