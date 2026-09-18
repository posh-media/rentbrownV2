"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "@rentbrown/ui";
import { useSession } from "@/lib/auth";
import { errorText } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(errorText(err));
      return;
    }
    router.replace("/account");
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <PageHeader title="Choose a new password" />
      <Card>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!loading && !session ? (
          <Alert variant="warning">
            This reset link has expired or is missing.{" "}
            <Link href="/forgot-password">Request a new one</Link>.
          </Alert>
        ) : (
          <form onSubmit={onSubmit}>
            <Field id="password" label="New password" required hint="At least 8 characters">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={busy} style={{ width: "100%" }}>
              Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
