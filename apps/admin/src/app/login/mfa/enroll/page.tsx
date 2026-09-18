"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, PageHeader, Spinner } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";

/** First-login TOTP enrolment — admin accounts must enrol a factor */
function EnrollForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (err) {
        setError(err.message);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
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
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 64 }}>
      <PageHeader
        title="Set up two-factor authentication"
        subtitle="Scan the QR code with your authenticator app, then enter the 6-digit code"
      />
      <Card>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!qr ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spinner label="Preparing enrolment" />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              {/* Supabase returns the QR as an SVG data URI */}
              <img src={qr} alt="TOTP QR code" width={180} height={180} />
            </div>
            {secret ? (
              <p className="rb-muted" style={{ fontSize: 13, textAlign: "center" }}>
                Manual entry: <code>{secret}</code>
              </p>
            ) : null}
            <form onSubmit={onSubmit}>
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
                Enable MFA
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense>
      <EnrollForm />
    </Suspense>
  );
}
