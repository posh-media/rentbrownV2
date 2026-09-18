import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Alert, Button, Field, Input, Screen, Spinner } from "../../../src/components/primitives";
import { api, errorCode, errorText } from "../../../src/lib/api";
import { useMe } from "../../../src/lib/me";

export default function Profile() {
  const { me, loading, refresh } = useMe();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    firstName: "",
    lastName: "",
    timezone: "",
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
      });
    }
  }, [me]);

  if (loading || !me) {
    return (
      <Screen>
        <Spinner label="Loading profile" />
      </Screen>
    );
  }

  async function save() {
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

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {saved ? <Alert variant="success">Profile saved.</Alert> : null}
        <Field label="Display name">
          <Input
            value={form.displayName}
            onChangeText={(v) => setForm((f) => ({ ...f, displayName: v }))}
          />
        </Field>
        <Field label="Username" error={usernameError ?? undefined}>
          <Input
            autoCapitalize="none"
            value={form.username}
            onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
          />
        </Field>
        <Field label="First name">
          <Input
            value={form.firstName}
            onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.lastName}
            onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
          />
        </Field>
        <Field label="Timezone">
          <Input
            autoCapitalize="none"
            value={form.timezone}
            onChangeText={(v) => setForm((f) => ({ ...f, timezone: v }))}
          />
        </Field>
        <Button title="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
