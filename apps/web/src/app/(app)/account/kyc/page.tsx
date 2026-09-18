"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { KycCaseDto } from "@rentbrown/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";
import { useMe } from "@/lib/me";

export default function KycPage() {
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
      <div
        className="rb-shell"
        style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
      >
        <Spinner label="Loading verification" />
      </div>
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
    <div className="rb-shell" style={{ maxWidth: 640, paddingTop: 48 }}>
      <PageHeader title="Identity verification" />
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Alert variant="info">
        Verification is performed by a licensed identity partner; your ID number is never stored by
        RentBrown.
      </Alert>

      {status === "NONE" ? (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Start verification</h2>
          <ul className="rb-muted" style={{ fontSize: 14, paddingLeft: 18 }}>
            {me.kyc.nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Button onClick={startCase} loading={busy} disabled={!me.kyc.canStart}>
            Start verification
          </Button>
        </Card>
      ) : null}

      {kycCase && (status === "DRAFT" || status === "MORE_INFO_REQUIRED") ? (
        <>
          {status === "MORE_INFO_REQUIRED" ? (
            <Alert variant="warning">
              We need a little more information — please resubmit the items below.
            </Alert>
          ) : null}
          <IdVerificationForm
            kycCase={kycCase}
            onDone={async (c) => {
              setKycCase(c);
              await refresh();
            }}
          />
          <DocumentsSection kycCase={kycCase} onChange={setKycCase} />
        </>
      ) : null}

      {kycCase && (status === "SUBMITTED" || status === "IN_REVIEW") ? (
        <Card>
          <div className="rb-row rb-row--between">
            <div>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Under review</h2>
              <p className="rb-muted" style={{ fontSize: 14 }}>
                We're reviewing your verification — this usually takes a short while.
              </p>
            </div>
            <Badge status={status}>{status.replace("_", " ")}</Badge>
          </div>
          <Button variant="secondary" onClick={syncCase} loading={busy} style={{ marginTop: 12 }}>
            Refresh status
          </Button>
          <CaseDetails kycCase={kycCase} />
        </Card>
      ) : null}

      {status === "APPROVED" ? (
        <Card>
          <Alert variant="success">
            Your identity is verified — tier {me.kyc.tier}. You're ready for investing when it
            launches.
          </Alert>
          <p>
            <Link href="/account">Back to account</Link>
          </p>
        </Card>
      ) : null}

      {status === "REJECTED" ? (
        <Card>
          <Alert variant="error">
            We couldn't verify your identity this time. Please contact{" "}
            <a href="mailto:support@rentbrown.example">support</a> for help.
          </Alert>
        </Card>
      ) : null}

      {status === "EXPIRED" ? (
        <Card>
          <Alert variant="warning">Your previous verification expired.</Alert>
          <Button onClick={startCase} loading={busy} style={{ marginTop: 12 }}>
            Start a new verification
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function IdVerificationForm({
  kycCase,
  onDone,
}: {
  kycCase: KycCaseDto;
  onDone: (c: KycCaseDto) => Promise<void>;
}) {
  const { me } = useMe();
  const allowed = me?.kyc.allowedIdTypes ?? {};
  const countries = Object.keys(allowed);
  const [country, setCountry] = useState(countries.includes("NG") ? "NG" : (countries[0] ?? "NG"));
  const idTypes = allowed[country] ?? [];
  const [idType, setIdType] = useState(idTypes[0] ?? "");
  const [idNumber, setIdNumber] = useState("");
  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep idType valid when country changes
  const effectiveIdType = idTypes.includes(idType) ? idType : (idTypes[0] ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      <h2 style={{ marginTop: 0, fontSize: 18 }}>ID verification</h2>
      <form onSubmit={onSubmit}>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Field id="kyc-country" label="Country" required>
          <Select id="kyc-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {(countries.length ? countries : ["NG"]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="kyc-idType" label="ID type" required>
          <Select
            id="kyc-idType"
            value={effectiveIdType}
            onChange={(e) => setIdType(e.target.value)}
          >
            {idTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="kyc-idNumber" label="ID number" required>
          <Input
            id="kyc-idNumber"
            required
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field id="kyc-firstName" label="First name" required>
          <Input
            id="kyc-firstName"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field id="kyc-lastName" label="Last name" required>
          <Input
            id="kyc-lastName"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        <Field id="kyc-dob" label="Date of birth" hint="Optional — YYYY-MM-DD">
          <Input id="kyc-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} style={{ width: "100%" }}>
          Submit for verification
        </Button>
      </form>
    </Card>
  );
}

function DocumentsSection({
  kycCase,
  onChange,
}: {
  kycCase: KycCaseDto;
  onChange: (c: KycCaseDto) => void;
}) {
  const [docType, setDocType] = useState("PROOF_OF_ADDRESS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await api.kyc.uploadDocument(kycCase.id, docType, file, file.name));
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
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
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Supporting documents</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="rb-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field id="doc-type" label="Document type">
          <Select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="PROOF_OF_ADDRESS">Proof of address</option>
            <option value="ID_CARD">ID card</option>
            <option value="PASSPORT">Passport</option>
            <option value="SELFIE">Selfie</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field id="doc-file" label="File">
          <input id="doc-file" ref={fileRef} type="file" accept="image/*,application/pdf" />
        </Field>
        <Button variant="secondary" onClick={upload} loading={busy}>
          Upload
        </Button>
      </div>
      {kycCase.documents.length > 0 ? (
        <Table
          columns={[
            { key: "type", header: "Type" },
            { key: "uploaded", header: "Uploaded" },
            { key: "actions", header: "" },
          ]}
          rows={kycCase.documents.map((d) => ({
            type: d.docType.replace(/_/g, " "),
            uploaded: new Date(d.createdAt).toLocaleDateString(),
            actions: (
              <Button variant="ghost" onClick={() => void remove(d.id)}>
                Delete
              </Button>
            ),
          }))}
        />
      ) : (
        <p className="rb-muted" style={{ fontSize: 14 }}>
          No documents uploaded yet.
        </p>
      )}
    </Card>
  );
}

function CaseDetails({ kycCase }: { kycCase: KycCaseDto }) {
  if (kycCase.checks.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 15 }}>Checks</h3>
      <Table
        columns={[
          { key: "type", header: "Check" },
          { key: "status", header: "Status" },
          { key: "outcome", header: "Outcome" },
        ]}
        rows={kycCase.checks.map((c) => ({
          type: c.idType?.replace(/_/g, " ") ?? c.checkType ?? "—",
          status: <Badge status={c.status}>{c.status}</Badge>,
          outcome: c.outcome ?? "—",
        }))}
      />
    </div>
  );
}
