"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AuditEventDto } from "@rentbrown/types";
import { formatDateTime } from "@rentbrown/ui";
import { Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Table } from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";

export default function AuditPage() {
  const [filters, setFilters] = useState({ targetType: "", targetId: "", actorId: "" });
  const [items, setItems] = useState<AuditEventDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { cursor?: string; append?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.listAudit({
          targetType: filters.targetType || undefined,
          targetId: filters.targetId || undefined,
          actorId: filters.actorId || undefined,
          cursor: opts.cursor,
        });
        setItems((prev) => (opts.append ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, []);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    void load();
  }

  return (
    <div>
      <PageHeader title="Audit log" />
      <Card>
        <form onSubmit={onFilter} className="rb-row" style={{ alignItems: "flex-end" }}>
          <Field id="f-targetType" label="Target type">
            <Input
              id="f-targetType"
              value={filters.targetType}
              onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
            />
          </Field>
          <Field id="f-targetId" label="Target ID">
            <Input
              id="f-targetId"
              value={filters.targetId}
              onChange={(e) => setFilters((f) => ({ ...f, targetId: e.target.value }))}
            />
          </Field>
          <Field id="f-actorId" label="Actor ID">
            <Input
              id="f-actorId"
              value={filters.actorId}
              onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value }))}
            />
          </Field>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
        {error ? (
          <p className="rb-error" role="alert">
            {error}
          </p>
        ) : null}
        {items.length === 0 && !loading ? (
          <EmptyState title="No audit events" />
        ) : (
          <Table
            columns={[
              { key: "at", header: "When" },
              { key: "actor", header: "Actor" },
              { key: "action", header: "Action" },
              { key: "target", header: "Target" },
            ]}
            rows={items.map((ev) => ({
              at: formatDateTime(ev.createdAt),
              actor: `${ev.actorType}:${ev.actorId?.slice(0, 8) ?? "—"}`,
              action: ev.action,
              target: ev.targetType ? `${ev.targetType}:${ev.targetId?.slice(0, 8) ?? ""}` : "—",
            }))}
          />
        )}
        {loading ? <Spinner label="Loading events" /> : null}
        {cursor ? (
          <Button
            variant="ghost"
            onClick={() => void load({ cursor, append: true })}
            style={{ marginTop: 12 }}
          >
            Load more
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
