import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import type { LegalDocumentDto } from "@rentbrown/types";
import {
  Alert,
  Body,
  Button,
  Field,
  Input,
  Screen,
  Spinner,
  Title,
} from "../src/components/primitives";
import { api, errorText } from "../src/lib/api";
import { useMe } from "../src/lib/me";
import { t } from "../src/theme";

export default function Onboarding() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [step, setStep] = useState<1 | 2>(1);
  const [docs, setDocs] = useState<LegalDocumentDto[] | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .legalDocuments()
      .then(setDocs)
      .catch(() => setDocs([]));
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

  useEffect(() => {
    if (!loading && me && me.pendingConsents.length === 0) {
      if (me.firstName && me.lastName) router.replace("/(tabs)/home");
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await refresh();
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !me || docs === null) {
    return (
      <Screen>
        <Spinner label="Preparing onboarding" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{step === 1 ? "Review and accept" : "A few basics"}</Title>
        <Body muted>Step {step} of 2</Body>
        <View style={{ height: 16 }} />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {step === 1 ? (
          pendingDocs.length === 0 ? (
            <>
              <Alert variant="success">All current documents accepted.</Alert>
              <Button title="Continue" onPress={() => setStep(2)} />
            </>
          ) : (
            <>
              {pendingDocs.map((d) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <Switch
                    accessibilityLabel={`Accept ${d.title}`}
                    value={!!accepted[d.id]}
                    onValueChange={(v) => setAccepted((a) => ({ ...a, [d.id]: v }))}
                    trackColor={{ true: t.action.primary }}
                  />
                  <View style={{ flex: 1 }}>
                    <Pressable
                      onPress={() => router.push(`/legal/${d.docType.toLowerCase()}`)}
                      accessibilityRole="link"
                    >
                      <Body>
                        I have read and accept the{" "}
                        <Text style={{ color: t.action.primary }}>{d.title}</Text> (v{d.version})
                      </Body>
                    </Pressable>
                    {d.summary ? (
                      <Body muted>
                        <Text style={{ fontSize: 12 }}>{d.summary}</Text>
                      </Body>
                    ) : null}
                  </View>
                </View>
              ))}
              <Button title="Accept and continue" onPress={acceptAll} loading={busy} />
            </>
          )
        ) : (
          <>
            <Field label="First name">
              <Input value={firstName} onChangeText={setFirstName} />
            </Field>
            <Field label="Last name">
              <Input value={lastName} onChangeText={setLastName} />
            </Field>
            <Button title="Finish" onPress={saveProfile} loading={busy} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
