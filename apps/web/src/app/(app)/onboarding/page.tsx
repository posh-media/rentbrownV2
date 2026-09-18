"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LegalDocumentDto } from "@rentbrown/types";
import { Alert, Button, Card, Checkbox, Field, Input, PageHeader, Spinner } from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";
import { useMe } from "@/lib/me";

export default function OnboardingPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [step, setStep] = useState<1 | 2>(1);
  const [docs, setDocs] = useState<LegalDocumentDto[] | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [prefs, setPrefs] = useState({ push: true, email: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .legalDocuments()
      .then(setDocs)
      .catch(() => setDocs([]));
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Africa/Lagos");
  }, []);

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
    }
  }, [me]);

  const pendingDocs = useMemo(
    () => (docs ?? []).filter((d) => me?.pendingConsents.includes(d.docType)),
    [docs, me],
  );

  // nothing left to do → straight to account
  useEffect(() => {
    if (!loading && me && me.pendingConsents.length === 0) {
      if (me.firstName && me.lastName) router.replace("/account");
      else setStep(2);
    }
  }, [loading, me, router]);

  async function acceptAll() {
    if (!pendingDocs.every((d) => accepted[d.id])) {
      setError("Please read and accept each document to continue");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const d of pendingDocs) await api.recordConsent(d.id);
      await refresh();
      setStep(2);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        timezone: timezone || undefined,
        notificationPrefs: prefs,
      });
      await refresh();
      router.replace("/account");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !me || docs === null) {
    return (
      <div
        className="rb-shell"
        style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
      >
        <Spinner label="Preparing onboarding" />
      </div>
    );
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 560, paddingTop: 64 }}>
      <PageHeader
        title={step === 1 ? "Review and accept" : "A few basics"}
        subtitle={
          step === 1
            ? "Step 1 of 2 — the documents that govern your account"
            : "Step 2 of 2 — your name and preferences"
        }
      />
      <Card>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {step === 1 ? (
          pendingDocs.length === 0 ? (
            <>
              <Alert variant="success">All current documents accepted.</Alert>
              <Button onClick={() => setStep(2)} style={{ marginTop: 16 }}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <div className="rb-stack">
                {pendingDocs.map((d) => (
                  <div key={d.id}>
                    <Checkbox
                      id={`doc-${d.id}`}
                      checked={!!accepted[d.id]}
                      onChange={(e) => setAccepted((a) => ({ ...a, [d.id]: e.target.checked }))}
                      label={
                        <>
                          I have read and accept the{" "}
                          <Link href={`/legal/${d.docType.toLowerCase()}`} target="_blank">
                            {d.title}
                          </Link>{" "}
                          (v{d.version})
                        </>
                      }
                    />
                    {d.summary ? (
                      <p className="rb-muted" style={{ fontSize: 13, margin: "4px 0 0 24px" }}>
                        {d.summary}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <Button onClick={acceptAll} loading={busy} style={{ marginTop: 20, width: "100%" }}>
                Accept and continue
              </Button>
            </>
          )
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <Field id="firstName" label="First name" required>
              <Input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field id="lastName" label="Last name" required>
              <Input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
            <Field id="timezone" label="Timezone" hint="Detected from your browser">
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </Field>
            <Checkbox
              id="pref-email"
              checked={prefs.email}
              onChange={(e) => setPrefs((p) => ({ ...p, email: e.target.checked }))}
              label="Email me about account activity"
            />
            <div style={{ height: 8 }} />
            <Checkbox
              id="pref-push"
              checked={prefs.push}
              onChange={(e) => setPrefs((p) => ({ ...p, push: e.target.checked }))}
              label="Send me push notifications"
            />
            <Button type="submit" loading={busy} style={{ marginTop: 20, width: "100%" }}>
              Finish
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
