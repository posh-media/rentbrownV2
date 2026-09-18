import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Button, Field, Input, Screen, Title } from "../../src/components/primitives";
import { errorText } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "rentbrown://auth/callback",
    });
    setBusy(false);
    if (err) {
      setError(errorText(err));
      return;
    }
    setSent(true);
  }

  return (
    <Screen style={{ justifyContent: "center" }}>
      <Title>Reset your password</Title>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {sent ? (
        <Alert variant="success">
          If an account exists for {email}, a reset link is on its way.
        </Alert>
      ) : (
        <>
          <Field label="Email">
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </Field>
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
      <Button variant="ghost" title="Back to log in" onPress={() => router.back()} />
    </Screen>
  );
}
