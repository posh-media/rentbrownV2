import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { signupSchema } from "@rentbrown/validation";
import { Alert, Body, Button, Field, Input, Screen, Title } from "../../src/components/primitives";
import { errorText } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";

export default function Signup() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    username: "",
    referralCode: ref ?? "",
    displayCurrency: "NGN",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
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
    setDone(true);
  }

  if (done) {
    return (
      <Screen style={{ justifyContent: "center" }}>
        <Title>Check your email</Title>
        <Body muted>
          We sent a confirmation link to {form.email}. Open it to finish creating your account, then
          log in.
        </Body>
        <Button
          variant="ghost"
          title="Back to log in"
          onPress={() => router.replace("/(auth)/login")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>Create your account</Title>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field label="Full name">
          <Input value={form.displayName} onChangeText={set("displayName")} />
        </Field>
        <Field label="Username" hint="Lowercase letters, numbers, _ and -">
          <Input autoCapitalize="none" value={form.username} onChangeText={set("username")} />
        </Field>
        <Field label="Email">
          <Input
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={form.email}
            onChangeText={set("email")}
          />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input
            secureTextEntry
            autoComplete="new-password"
            value={form.password}
            onChangeText={set("password")}
          />
        </Field>
        <Field label="Referral code" hint="Optional">
          <Input
            autoCapitalize="none"
            value={form.referralCode}
            onChangeText={set("referralCode")}
          />
        </Field>
        <Button title="Create account" onPress={submit} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
