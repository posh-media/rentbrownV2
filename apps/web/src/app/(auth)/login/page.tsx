"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError("Invalid email or password"); // deliberately generic
      return;
    }
    router.replace(next.startsWith("/") ? next : "/account");
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <PageHeader title="Log in" subtitle="Welcome back to RentBrown" />
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
        <p className="rb-muted" style={{ fontSize: 13, marginTop: 16 }}>
          <Link href="/forgot-password">Forgot your password?</Link> ·{" "}
          <Link href="/signup">Create an account</Link>
        </p>
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
