"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AccountStatus, AdminUserDto } from "@rentbrown/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AccountStatus>("");
  const [items, setItems] = useState<AdminUserDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { q?: string; status?: string; cursor?: string; append?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.listUsers({
          q: opts.q || undefined,
          status: (opts.status || undefined) as AccountStatus | undefined,
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
    [],
  );

  useEffect(() => {
    void load({});
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load({ q, status });
  }

  return (
    <div>
      <PageHeader title="Users" />
      <Card>
        <form onSubmit={onSearch} className="rb-row" style={{ alignItems: "flex-end" }}>
          <Field id="q" label="Search">
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="email or name"
            />
          </Field>
          <Field id="status" label="Status">
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus | "")}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="RESTRICTED">Restricted</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {error ? (
          <p className="rb-error" role="alert">
            {error}
          </p>
        ) : null}
        {items.length === 0 && !loading ? (
          <EmptyState title="No users found" />
        ) : (
          <Table
            columns={[
              { key: "email", header: "Email" },
              { key: "name", header: "Name" },
              { key: "status", header: "Status" },
              { key: "created", header: "Joined" },
            ]}
            rows={items.map((u) => ({
              email: <Link href={`/users/${u.id}`}>{u.email ?? u.id}</Link>,
              name: u.displayName ?? u.username ?? "—",
              status: <Badge status={u.accountStatus} />,
              created: new Date(u.createdAt).toLocaleDateString(),
            }))}
          />
        )}
        {loading ? <Spinner label="Loading users" /> : null}
        {cursor ? (
          <Button
            variant="ghost"
            onClick={() => void load({ q, status, cursor, append: true })}
            style={{ marginTop: 12 }}
          >
            Load more
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
