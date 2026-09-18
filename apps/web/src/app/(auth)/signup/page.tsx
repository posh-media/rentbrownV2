"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { signupSchema } from "@rentbrown/validation";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "@rentbrown/ui";
import { errorText } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function SignupForm() {
  const router = useRouter();
  const ref = useSearchParams().get("ref") ?? "";
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    username: "",
    referralCode: ref,
    displayCurrency: "NGN",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      ...form,
      referralCode: form.referralCode || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          display_name: form.displayName,
          username: form.username,
          display_currency: form.displayCurrency,
          account_currency: form.displayCurrency,
          referral_code: form.referralCode || undefined,
        },
      },
    });
    setBusy(false);
    if (err) {
      setError(errorText(err));
      return;
    }
    if (data.session) {
      router.replace("/onboarding");
      return;
    }
    setDone(true); // email confirmation required
  }

  if (done) {
    return (
      <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
        <Card>
          <PageHeader title="Check your email" />
          <p className="rb-muted">
            We sent a confirmation link to <strong>{form.email}</strong>. Open it to finish creating
            your account, then log in.
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/login">Back to log in</Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 64 }}>
      <PageHeader title="Create your account" subtitle="Invest in property-backed opportunities" />
      <Card>
        <form onSubmit={onSubmit}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field id="displayName" label="Full name" required>
            <Input
              id="displayName"
              required
              value={form.displayName}
              onChange={set("displayName")}
            />
          </Field>
          <Field id="username" label="Username" required hint="Lowercase letters, numbers, _ and -">
            <Input id="username" required value={form.username} onChange={set("username")} />
          </Field>
          <Field id="email" label="Email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
          </Field>
          <Field id="password" label="Password" required hint="At least 8 characters">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
            />
          </Field>
          <Field id="displayCurrency" label="Display currency">
            <Select
              id="displayCurrency"
              value={form.displayCurrency}
              onChange={set("displayCurrency")}
            >
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
          </Field>
          <Field id="referralCode" label="Referral code" hint="Optional">
            <Input id="referralCode" value={form.referralCode} onChange={set("referralCode")} />
          </Field>
          <Button type="submit" loading={busy} style={{ width: "100%" }}>
            Create account
          </Button>
        </form>
        <p className="rb-muted" style={{ fontSize: 13, marginTop: 16 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
