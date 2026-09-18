"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminKycCaseDto } from "@rentbrown/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";

const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "MORE_INFO_REQUIRED",
  "EXPIRED",
];

export default function KycListPage() {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminKycCaseDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts: { status?: string; cursor?: string; append?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.admin.kyc.listCases({
        status: opts.status || undefined,
        cursor: opts.cursor,
      });
      setItems((prev) => (opts.append ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({});
  }, [load]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    void load({ status });
  }

  return (
    <div>
      <PageHeader title="KYC cases" />
      <Card>
        <form onSubmit={onFilter} className="rb-row" style={{ alignItems: "flex-end" }}>
          <Field id="status" label="Status">
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
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
          <EmptyState title="No cases found" />
        ) : (
          <Table
            columns={[
              { key: "user", header: "User" },
              { key: "status", header: "Status" },
              { key: "tier", header: "Tier" },
              { key: "created", header: "Created" },
            ]}
            rows={items.map((c) => ({
              user: <Link href={`/kyc/${c.id}`}>{c.userEmail ?? c.userId}</Link>,
              status: <Badge status={c.status} />,
              tier: `${c.currentTier} → ${c.requestedTier}`,
              created: new Date(c.createdAt).toLocaleDateString(),
            }))}
          />
        )}
        {loading ? <Spinner label="Loading cases" /> : null}
        {cursor ? (
          <Button
            variant="ghost"
            onClick={() => void load({ status, cursor, append: true })}
            style={{ marginTop: 12 }}
          >
            Load more
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
