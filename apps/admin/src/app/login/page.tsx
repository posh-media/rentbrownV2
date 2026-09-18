"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      setError("Invalid email or password");
      return;
    }
    // MFA gate: if the account has TOTP enrolled we must reach aal2
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasFactor = (factors?.totp ?? []).length > 0;
    setBusy(false);
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
    } else if (!hasFactor) {
      router.replace(`/login/mfa/enroll?next=${encodeURIComponent(next)}`);
    } else {
      router.replace(next.startsWith("/") ? next : "/dashboard");
    }
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <PageHeader title="Admin console" subtitle="RentBrown operations — authorised staff only" />
      <Card>
        <form onSubmit={onSubmit}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field id="email" label="Email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field id="password" label="Password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={busy} style={{ width: "100%" }}>
            Log in
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
