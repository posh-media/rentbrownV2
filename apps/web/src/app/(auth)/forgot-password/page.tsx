"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "@rentbrown/ui";
import { errorText } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(errorText(err));
      return;
    }
    setSent(true);
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <PageHeader title="Reset your password" />
      <Card>
        {sent ? (
          <Alert variant="success">
            If an account exists for {email}, a reset link is on its way.
          </Alert>
        ) : (
          <form onSubmit={onSubmit}>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <Field id="email" label="Email" required>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={busy} style={{ width: "100%" }}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="rb-muted" style={{ fontSize: 13, marginTop: 16 }}>
          <Link href="/login">Back to log in</Link>
        </p>
      </Card>
    </div>
  );
}
