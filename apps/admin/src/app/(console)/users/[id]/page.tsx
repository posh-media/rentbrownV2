"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AccountStatus, AdminUserDto, RoleDto } from "@rentbrown/types";
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
} from "@rentbrown/ui";
import { api, errorText } from "@/lib/api";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDto | null>(null);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<AccountStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");
  const [roleName, setRoleName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.admin.getUser(id), api.admin.listRoles()]);
      setUser(u);
      setRoles(r);
      setNewStatus(u.accountStatus);
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

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spinner label="Loading user" />
      </div>
    );
  }
  if (error || !user) return <Alert variant="error">{error ?? "User not found"}</Alert>;

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title={user.displayName ?? user.email ?? user.id}
        subtitle={`@${user.username ?? "—"} · joined ${new Date(user.createdAt).toLocaleDateString()}`}
      />
      <div className="rb-stack">
        <Card>
          <div className="rb-row rb-row--between">
            <div className="rb-muted" style={{ fontSize: 14 }}>
              <p style={{ margin: 0 }}>Email: {user.email ?? "—"}</p>
              <p style={{ margin: "4px 0" }}>
                Name: {user.firstName ?? "—"} {user.lastName ?? ""}
              </p>
              <p style={{ margin: "4px 0" }}>Phone: {user.phone ?? "—"}</p>
              <p style={{ margin: "4px 0" }}>
                Last seen: {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : "—"}
              </p>
              {user.statusReason ? (
                <p style={{ margin: "4px 0" }}>Status reason: {user.statusReason}</p>
              ) : null}
            </div>
            <Badge status={user.accountStatus} />
          </div>
          <p style={{ fontSize: 14 }}>
            Roles:{" "}
            {user.roles.length
              ? user.roles.map((r) => (
                  <Badge key={r} status={r}>
                    {r}
                  </Badge>
                ))
              : "—"}
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Change status</h2>
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          {actionOk ? <Alert variant="success">{actionOk}</Alert> : null}
          <div className="rb-row" style={{ alignItems: "flex-end" }}>
            <Field id="new-status" label="Status">
              <Select
                id="new-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as AccountStatus)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </Field>
            <Field id="status-reason" label="Reason" required>
              <Input
                id="status-reason"
                required
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              loading={busy}
              disabled={statusReason.trim().length < 3}
              onClick={() =>
                void run(
                  () => api.admin.setStatus(id, newStatus, statusReason.trim()),
                  "Status updated",
                )
              }
            >
              Apply
            </Button>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Roles</h2>
          <div className="rb-row" style={{ alignItems: "flex-end" }}>
            <Field id="role" label="Role">
              <Select id="role" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                <option value="">Select…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="secondary"
              loading={busy}
              disabled={!roleName}
              onClick={() => void run(() => api.admin.assignRole(id, roleName), "Role assigned")}
            >
              Assign
            </Button>
            <Button
              variant="ghost"
              loading={busy}
              disabled={!roleName}
              onClick={() => void run(() => api.admin.revokeRole(id, roleName), "Role revoked")}
            >
              Revoke
            </Button>
          </div>
        </Card>

        <p>
          <Link href="/users">← Back to users</Link>
        </p>
      </div>
    </div>
  );
}
