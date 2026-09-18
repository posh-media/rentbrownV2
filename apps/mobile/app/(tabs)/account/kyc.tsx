import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { KycCaseDto } from "@rentbrown/types";
import {
  Alert,
  Badge,
  Body,
  Button,
  Card,
  Field,
  Input,
  Screen,
  Spinner,
  Title,
} from "../../../src/components/primitives";
import { api, errorText } from "../../../src/lib/api";
import { useMe } from "../../../src/lib/me";
import { t } from "../../../src/theme";

export default function Kyc() {
  const { me, loading, refresh } = useMe();
  const [kycCase, setKycCase] = useState<KycCaseDto | null>(null);
  const [caseLoading, setCaseLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    setCaseLoading(true);
    try {
      const summary = await api.kyc.status();
      setKycCase(summary.caseId ? await api.kyc.getCase(summary.caseId) : null);
    } catch {
      setKycCase(null);
    } finally {
      setCaseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) void loadCase();
  }, [me, loadCase]);

  if (loading || !me || caseLoading) {
    return (
      <Screen>
        <Spinner label="Loading verification" />
      </Screen>
    );
  }

  const status = kycCase?.status ?? "NONE";

  async function startCase() {
    setBusy(true);
    setError(null);
    try {
      setKycCase(await api.kyc.startCase(1));
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function syncCase() {
    if (!kycCase) return;
    setBusy(true);
    setError(null);
    try {
      setKycCase(await api.kyc.sync(kycCase.id));
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>Identity verification</Title>
        <View style={{ height: 12 }} />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Alert variant="info">
          Verification is performed by a licensed identity partner; your ID number is never stored
          by RentBrown.
        </Alert>

        {status === "NONE" ? (
          <Card>
            <Body>Start verification</Body>
            {me.kyc.nextSteps.map((s) => (
              <Body key={s} muted>
                • {s}
              </Body>
            ))}
            <Button
              title="Start verification"
              onPress={startCase}
              loading={busy}
              disabled={!me.kyc.canStart}
            />
          </Card>
        ) : null}

        {kycCase && (status === "DRAFT" || status === "MORE_INFO_REQUIRED") ? (
          <>
            {status === "MORE_INFO_REQUIRED" ? (
              <Alert variant="warning">
                We need a little more information — please resubmit the items below.
              </Alert>
            ) : null}
            <IdForm
              kycCase={kycCase}
              onDone={async (c) => {
                setKycCase(c);
                await refresh();
              }}
            />
            <Docs kycCase={kycCase} onChange={setKycCase} />
          </>
        ) : null}

        {kycCase && (status === "SUBMITTED" || status === "IN_REVIEW") ? (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Body>Under review</Body>
              <Badge status={status} />
            </View>
            <Body muted>This usually takes a short while.</Body>
            <Button variant="secondary" title="Refresh status" onPress={syncCase} loading={busy} />
          </Card>
        ) : null}

        {status === "APPROVED" ? (
          <Alert variant="success">Your identity is verified — tier {me.kyc.tier}.</Alert>
        ) : null}

        {status === "REJECTED" ? (
          <Alert variant="error">
            We couldn't verify your identity this time. Please contact support for help.
          </Alert>
        ) : null}

        {status === "EXPIRED" ? (
          <Card>
            <Alert variant="warning">Your previous verification expired.</Alert>
            <Button title="Start a new verification" onPress={startCase} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function IdForm({
  kycCase,
  onDone,
}: {
  kycCase: KycCaseDto;
  onDone: (c: KycCaseDto) => Promise<void>;
}) {
  const { me } = useMe();
  const allowed = me?.kyc.allowedIdTypes ?? {};
  const country = "NG";
  const idTypes = allowed[country] ?? allowed[Object.keys(allowed)[0] ?? ""] ?? [];
  const [idType, setIdType] = useState(idTypes[0] ?? "");
  const [idNumber, setIdNumber] = useState("");
  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveIdType = idTypes.includes(idType) ? idType : (idTypes[0] ?? "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.kyc.submitIdVerification(kycCase.id, {
        country,
        idType: effectiveIdType,
        idNumber: idNumber.trim(),
        firstName,
        lastName,
        dob: dob || undefined,
      });
      await onDone(updated);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Body>ID verification ({country})</Body>
      <View style={{ height: 8 }} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Field label="ID type">
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {idTypes.map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              onPress={() => setIdType(type)}
              style={{
                borderWidth: 1,
                borderColor: effectiveIdType === type ? t.action.primary : t.border.default,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: effectiveIdType === type ? t.action.secondary : "transparent",
              }}
            >
              <Text style={{ color: t.text.primary, fontSize: 13 }}>{type.replace(/_/g, " ")}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="ID number">
        <Input autoCapitalize="none" value={idNumber} onChangeText={setIdNumber} />
      </Field>
      <Field label="First name">
        <Input value={firstName} onChangeText={setFirstName} />
      </Field>
      <Field label="Last name">
        <Input value={lastName} onChangeText={setLastName} />
      </Field>
      <Field label="Date of birth" hint="Optional — YYYY-MM-DD">
        <Input autoCapitalize="none" placeholder="1990-01-31" value={dob} onChangeText={setDob} />
      </Field>
      <Button title="Submit for verification" onPress={submit} loading={busy} />
    </Card>
  );
}

function Docs({ kycCase, onChange }: { kycCase: KycCaseDto; onChange: (c: KycCaseDto) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: { uri: string; name: string; mimeType?: string }) {
    setBusy(true);
    setError(null);
    try {
      // React Native FormData accepts { uri, name, type } file descriptors
      const rnFile = {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/octet-stream",
      } as unknown as File;
      onChange(await api.kyc.uploadDocument(kycCase.id, "OTHER", rnFile, file.name));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    await upload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.kyc.deleteDocument(id);
      onChange({ ...kycCase, documents: kycCase.documents.filter((d) => d.id !== id) });
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Card>
      <Body>Supporting documents</Body>
      <View style={{ height: 8 }} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {kycCase.documents.map((d) => (
        <View
          key={d.id}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Body muted>
            {d.docType.replace(/_/g, " ")} — {new Date(d.createdAt).toLocaleDateString()}
          </Body>
          <Pressable accessibilityRole="button" onPress={() => void remove(d.id)}>
            <Text style={{ color: t.status.error.fg }}>Delete</Text>
          </Pressable>
        </View>
      ))}
      <Button variant="secondary" title="Upload a photo" onPress={pickImage} loading={busy} />
      <Button variant="ghost" title="Upload a file" onPress={pickDocument} loading={busy} />
    </Card>
  );
}
