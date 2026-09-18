"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AdminKycCaseDto } from "@rentbrown/types";
import { formatDateTime } from "@rentbrown/ui";
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

export default function KycDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [kycCase, setKycCase] = useState<AdminKycCaseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "REQUEST_MORE_INFO">("APPROVE");
  const [reason, setReason] = useState("");
  const [tier, setTier] = useState(1);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.admin.kyc.getCase(id);
      setKycCase(c);
      setTier(c.requestedTier);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setActionError(null);
    setActionOk(null);
    try {
      await fn();
      setActionOk(ok);
      await load();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function viewDocument(docId: string) {
    try {
      const { url } = await api.admin.kyc.documentUrl(docId);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spinner label="Loading case" />
      </div>
    );
  }
  if (error || !kycCase) return <Alert variant="error">{error ?? "Case not found"}</Alert>;

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader
        title={`KYC case — ${kycCase.userEmail ?? kycCase.userId}`}
        subtitle={`Requested tier ${kycCase.requestedTier} · current ${kycCase.currentTier} · policy ${kycCase.policyVersion ?? "—"}`}
      />
      <div className="rb-stack">
        <Card>
          <div className="rb-row rb-row--between">
            <Badge status={kycCase.status} />
            <Button
              variant="ghost"
              loading={busy}
              onClick={() => void run(() => api.admin.kyc.sync(id), "Synced from provider")}
            >
              Sync from provider
            </Button>
          </div>
          <p className="rb-muted" style={{ fontSize: 13, marginTop: 12 }}>
            Submitted {kycCase.submittedAt ? formatDateTime(kycCase.submittedAt) : "—"} · Reviewed{" "}
            {kycCase.reviewedAt ? formatDateTime(kycCase.reviewedAt) : "—"} · Expires{" "}
            {kycCase.expiresAt ? formatDateTime(kycCase.expiresAt) : "—"}
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Checks</h2>
          {kycCase.checks.length === 0 ? (
            <p className="rb-muted" style={{ fontSize: 14 }}>
              No checks yet.
            </p>
          ) : (
            <Table
              columns={[
                { key: "type", header: "Type" },
                { key: "idType", header: "ID" },
                { key: "last4", header: "Last 4" },
                { key: "status", header: "Status" },
                { key: "outcome", header: "Outcome" },
                { key: "provider", header: "Provider message" },
              ]}
              rows={kycCase.checks.map((c) => ({
                type: c.checkType ?? "—",
                idType: c.idType ?? "—",
                last4: c.idNumberLast4 ?? "—",
                status: <Badge status={c.status} />,
                outcome: c.outcome ?? "—",
                provider: c.providerMessage ?? "—",
              }))}
            />
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Documents</h2>
          {kycCase.documents.length === 0 ? (
            <p className="rb-muted" style={{ fontSize: 14 }}>
              No documents.
            </p>
          ) : (
            <Table
              columns={[
                { key: "type", header: "Type" },
                { key: "uploaded", header: "Uploaded" },
                { key: "view", header: "" },
              ]}
              rows={kycCase.documents.map((d) => ({
                type: d.docType,
                uploaded: formatDateTime(d.createdAt),
                view: (
                  <Button variant="ghost" onClick={() => void viewDocument(d.id)}>
                    View (60s link)
                  </Button>
                ),
              }))}
            />
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Decisions</h2>
          {kycCase.decisions.length === 0 ? (
            <p className="rb-muted" style={{ fontSize: 14 }}>
              No decisions recorded.
            </p>
          ) : (
            <ul className="rb-muted" style={{ fontSize: 14, paddingLeft: 18 }}>
              {kycCase.decisions.map((d) => (
                <li key={d.id}>
                  {formatDateTime(d.createdAt)} — {d.source}: {d.decision}
                  {d.fromStatus || d.toStatus
                    ? ` (${d.fromStatus ?? "?"} → ${d.toStatus ?? "?"})`
                    : ""}
                  {d.reason ? ` — ${d.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Review</h2>
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          {actionOk ? <Alert variant="success">{actionOk}</Alert> : null}
          <div className="rb-row" style={{ alignItems: "flex-end" }}>
            <Field id="decision" label="Decision">
              <Select
                id="decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value as typeof decision)}
              >
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="REQUEST_MORE_INFO">Request more info</option>
              </Select>
            </Field>
            {decision === "APPROVE" ? (
              <Field id="tier" label="Tier">
                <Input
                  id="tier"
                  type="number"
                  min={1}
                  max={3}
                  value={tier}
                  onChange={(e) => setTier(Number(e.target.value))}
                />
              </Field>
            ) : null}
            <Field id="reason" label="Reason (required)" required>
              <Input
                id="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button
              variant={decision === "APPROVE" ? "primary" : "destructive"}
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() =>
                void run(
                  () =>
                    api.admin.kyc.decide(
                      id,
                      decision,
                      reason.trim(),
                      decision === "APPROVE" ? tier : undefined,
                    ),
                  "Decision recorded",
                )
              }
            >
              Submit decision
            </Button>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Internal notes</h2>
          {kycCase.notesInternal ? (
            <pre
              className="rb-muted"
              style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "inherit" }}
            >
              {kycCase.notesInternal}
            </pre>
          ) : (
            <p className="rb-muted" style={{ fontSize: 14 }}>
              No notes yet.
            </p>
          )}
          <div className="rb-row" style={{ alignItems: "flex-end" }}>
            <Field id="note" label="Add note">
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              variant="secondary"
              loading={busy}
              disabled={note.trim().length < 2}
              onClick={() =>
                void run(async () => {
                  await api.admin.kyc.addNote(id, note.trim());
                  setNote("");
                }, "Note added")
              }
            >
              Add note
            </Button>
          </div>
        </Card>

        <p>
          <Link href="/kyc">← Back to cases</Link>
        </p>
      </div>
    </div>
  );
}
