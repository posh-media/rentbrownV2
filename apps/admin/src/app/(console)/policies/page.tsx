"use client";

import { useCallback, useEffect, useState } from "react";
import type { PolicyDto } from "@rentbrown/types";
import { formatDateTime } from "@rentbrown/ui";
import { Alert, Button, Card, PageHeader, Spinner } from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowOk, setRowOk] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.admin.listPolicies();
      setPolicies(list);
      setDrafts(Object.fromEntries(list.map((p) => [p.key, JSON.stringify(p.value, null, 2)])));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(key: string) {
    setSaving(key);
    setRowErrors((m) => ({ ...m, [key]: "" }));
    setRowOk((m) => ({ ...m, [key]: "" }));
    try {
      let value: unknown;
      try {
        value = JSON.parse(drafts[key] ?? "null");
      } catch {
        throw new Error("Invalid JSON");
      }
      await api.admin.setPolicy(key, value);
      setRowOk((m) => ({ ...m, [key]: "Saved" }));
      await load();
    } catch (err) {
      setRowErrors((m) => ({ ...m, [key]: errorText(err) }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader title="Policies" />
      <Alert variant="warning">
        Changes take effect within ~30s per API instance. Values are validated and versioned by the
        server.
      </Alert>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? (
        <Spinner label="Loading policies" />
      ) : (
        policies.map((p) => (
          <Card key={p.key}>
            <div className="rb-row rb-row--between" style={{ marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{p.key}</strong>
                {p.description ? (
                  <p className="rb-muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                    {p.description}
                  </p>
                ) : null}
              </div>
              <span className="rb-muted" style={{ fontSize: 12 }}>
                v{p.version} · {formatDateTime(p.updatedAt)}
              </span>
            </div>
            <label className="rb-label" htmlFor={`policy-${p.key}`} style={{ fontSize: 13 }}>
              Value (JSON)
            </label>
            <textarea
              id={`policy-${p.key}`}
              className="rb-input"
              rows={Math.min(10, (drafts[p.key]?.split("\n").length ?? 3) + 1)}
              style={{ fontFamily: "monospace", fontSize: 13 }}
              value={drafts[p.key] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
            />
            {rowErrors[p.key] ? (
              <p className="rb-error" role="alert">
                {rowErrors[p.key]}
              </p>
            ) : null}
            {rowOk[p.key] ? (
              <p style={{ color: "var(--status-success-fg)", fontSize: 13 }} role="status">
                {rowOk[p.key]}
              </p>
            ) : null}
            <Button
              variant="secondary"
              loading={saving === p.key}
              onClick={() => void save(p.key)}
              style={{ marginTop: 8 }}
            >
              Save
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
