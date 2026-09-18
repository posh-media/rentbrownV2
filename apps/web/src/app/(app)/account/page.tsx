"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ConsentDto } from "@rentbrown/types";
import { Alert, Badge, Button, Card, PageHeader, Spinner } from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [consents, setConsents] = useState<ConsentDto[]>([]);
  const [copied, setCopied] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myConsents()
      .then(setConsents)
      .catch(() => {});
  }, [me]);

  if (loading || !me) {
    return (
      <div
        className="rb-shell"
        style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
      >
        <Spinner label="Loading account" />
      </div>
    );
  }

  const withdrawal = me.capabilities.withdrawal;

  async function togglePref(key: "email" | "push", value: boolean) {
    setPrefError(null);
    try {
      await api.updateProfile({ notificationPrefs: { ...me!.notificationPrefs, [key]: value } });
      await refresh();
    } catch (err) {
      setPrefError(errorText(err));
    }
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 720, paddingTop: 48 }}>
      <PageHeader title="Account" subtitle="Your profile, verification and preferences" />

      {withdrawal?.reason === "KYC_REQUIRED" ? (
        <Alert variant="info">
          Complete identity verification to enable withdrawals when they launch.
        </Alert>
      ) : null}
      {me.pendingConsents.length > 0 ? (
        <Alert variant="warning">
          You have updated documents to review. <Link href="/onboarding">Review now</Link>
        </Alert>
      ) : null}

      <div className="rb-stack">
        <Card>
          <div className="rb-row rb-row--between">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{me.displayName ?? me.username}</h2>
              <p className="rb-muted" style={{ margin: "4px 0 0" }}>
                @{me.username} · {me.email}
              </p>
              <p className="rb-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                Member since {new Date(me.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge status={me.accountStatus}>{me.accountStatus}</Badge>
          </div>
          {me.referralCode ? (
            <p style={{ marginTop: 12, fontSize: 13 }}>
              Your referral code: <code>{me.referralCode}</code>{" "}
              <Button
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(me.referralCode!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </p>
          ) : null}
          <p style={{ marginTop: 8 }}>
            <Link href="/account/profile">Edit profile</Link>
          </p>
        </Card>

        <Card>
          <div className="rb-row rb-row--between">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Identity verification</h2>
              <p className="rb-muted" style={{ margin: "4px 0 0" }}>
                {me.kyc.status === "APPROVED"
                  ? `Verified — tier ${me.kyc.tier}`
                  : "Verify your identity to unlock investing when it launches."}
              </p>
            </div>
            <Badge status={me.kyc.status}>
              {me.kyc.status === "NONE" ? "Not started" : me.kyc.status}
            </Badge>
          </div>
          <p style={{ marginTop: 12 }}>
            <Link href="/account/kyc">
              {me.kyc.canStart ? "Start verification" : "View verification"}
            </Link>
          </p>
        </Card>

        <Card>
          <h2 style={{ margin: 0, fontSize: 18 }}>Preferences</h2>
          {prefError ? <Alert variant="error">{prefError}</Alert> : null}
          <p className="rb-muted" style={{ fontSize: 14 }}>
            Display currency: {me.displayCurrency}
          </p>
          <div className="rb-row">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={me.notificationPrefs.email ?? true}
                onChange={(e) => void togglePref("email", e.target.checked)}
              />
              Email notifications
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={me.notificationPrefs.push ?? true}
                onChange={(e) => void togglePref("push", e.target.checked)}
              />
              Push notifications
            </label>
          </div>
        </Card>

        <Card>
          <h2 style={{ margin: 0, fontSize: 18 }}>Legal</h2>
          {consents.length === 0 ? (
            <p className="rb-muted" style={{ fontSize: 14 }}>
              No documents accepted yet.
            </p>
          ) : (
            <ul className="rb-muted" style={{ fontSize: 14, paddingLeft: 18 }}>
              {consents.map((c) => (
                <li key={c.id}>
                  <Link href={`/legal/${c.docType.toLowerCase()}`}>{c.docType}</Link> v{c.version} —
                  accepted {new Date(c.acceptedAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="rb-row rb-row--between">
            <p className="rb-muted" style={{ margin: 0, fontSize: 14 }}>
              Signed in as {me.email}
            </p>
            <Button
              variant="secondary"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/");
              }}
            >
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
