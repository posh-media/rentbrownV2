"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";

/** TOTP challenge — user already has an enrolled factor */
function MfaForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (listErr || !factor) throw new Error("No authenticator factor enrolled");
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      router.replace(next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <PageHeader
        title="Two-factor authentication"
        subtitle="Enter the code from your authenticator app"
      />
      <Card>
        <form onSubmit={onSubmit}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field id="code" label="6-digit code" required>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={busy} style={{ width: "100%" }}>
            Verify
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}
