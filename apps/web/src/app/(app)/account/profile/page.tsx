"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@rentbrown/ui";
import { api, errorCode, errorText } from "@/lib/api";
import { useMe } from "@/lib/me";

export default function ProfilePage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    firstName: "",
    lastName: "",
    timezone: "",
    displayCurrency: "NGN" as "NGN" | "USD",
    prefs: { push: true, email: true, marketing: false, maturity: true, security: true },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me) {
      setForm({
        displayName: me.displayName ?? "",
        username: me.username ?? "",
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        timezone: me.timezone ?? "",
        displayCurrency: me.displayCurrency,
        prefs: {
          push: me.notificationPrefs.push ?? true,
          email: me.notificationPrefs.email ?? true,
          marketing: me.notificationPrefs.marketing ?? false,
          maturity: me.notificationPrefs.maturity ?? true,
          security: me.notificationPrefs.security ?? true,
        },
      });
    }
  }, [me]);

  if (loading || !me) {
    return (
      <div
        className="rb-shell"
        style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
      >
        <Spinner label="Loading profile" />
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUsernameError(null);
    setSaved(false);
    try {
      await api.updateProfile({
        displayName: form.displayName || undefined,
        username: form.username || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        timezone: form.timezone || undefined,
        displayCurrency: form.displayCurrency,
        notificationPrefs: form.prefs,
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      const code = errorCode(err);
      if (code === "USERNAME_TAKEN" || code === "USERNAME_CHANGE_DISABLED") {
        setUsernameError(errorText(err));
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const setPref = (k: keyof typeof form.prefs) => (e: { target: { checked: boolean } }) =>
    setForm((f) => ({ ...f, prefs: { ...f.prefs, [k]: e.target.checked } }));

  return (
    <div className="rb-shell" style={{ maxWidth: 560, paddingTop: 48 }}>
      <PageHeader title="Edit profile" />
      <Card>
        <form onSubmit={onSubmit}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          {saved ? <Alert variant="success">Profile saved.</Alert> : null}
          <Field id="displayName" label="Display name">
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </Field>
          <Field id="username" label="Username" error={usernameError ?? undefined}>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
          </Field>
          <Field id="firstName" label="First name">
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </Field>
          <Field id="lastName" label="Last name">
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Field>
          <Field id="timezone" label="Timezone">
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            />
          </Field>
          <Field id="displayCurrency" label="Display currency">
            <Select
              id="displayCurrency"
              value={form.displayCurrency}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayCurrency: e.target.value as "NGN" | "USD" }))
              }
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
          <div className="rb-stack" style={{ marginBottom: 16 }}>
            <Checkbox
              id="p-email"
              checked={form.prefs.email}
              onChange={setPref("email")}
              label="Email notifications"
            />
            <Checkbox
              id="p-push"
              checked={form.prefs.push}
              onChange={setPref("push")}
              label="Push notifications"
            />
            <Checkbox
              id="p-maturity"
              checked={form.prefs.maturity}
              onChange={setPref("maturity")}
              label="Maturity reminders"
            />
            <Checkbox
              id="p-security"
              checked={form.prefs.security}
              onChange={setPref("security")}
              label="Security alerts"
            />
            <Checkbox
              id="p-marketing"
              checked={form.prefs.marketing}
              onChange={setPref("marketing")}
              label="Product updates"
            />
          </div>
          <div className="rb-row">
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
