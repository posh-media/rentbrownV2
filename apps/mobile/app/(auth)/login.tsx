import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Alert, Button, Field, Input, Screen, Title } from "../../src/components/primitives";
import { supabase } from "../../src/lib/supabase";
import { t } from "../../src/theme";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError("Invalid email or password");
      return;
    }
    router.replace("/(tabs)/home");
  }

  return (
    <Screen style={{ justifyContent: "center" }}>
      <Title>Log in</Title>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Field label="Email">
        <Input
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </Field>
      <Field label="Password">
        <Input
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
      </Field>
      <Button title="Log in" onPress={submit} loading={busy} />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/(auth)/forgot-password")}
        style={{ marginTop: 16 }}
      >
        <Text style={{ color: t.action.primary, fontSize: 14 }}>Forgot your password?</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/(auth)/signup")}
        style={{ marginTop: 8 }}
      >
        <Text style={{ color: t.action.primary, fontSize: 14 }}>Create an account</Text>
      </Pressable>
    </Screen>
  );
}
