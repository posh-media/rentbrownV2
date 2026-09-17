import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema, type Database } from "@rentbrown/database";
import type { AdminAuditQuery, AdminUsersQuery } from "@rentbrown/validation";
import type { AdminUserDto, AuditEventDto, ConsentSummaryDto, Paginated } from "@rentbrown/types";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { LegalService } from "../legal/legal.service.js";
import { RolesService } from "../rbac/roles.service.js";
import { toUserDto } from "../users/users.controller.js";
import type { InternalUser } from "../users/users.service.js";

const { users, auditEvents } = schema;

/** cursor = `${createdAt.toISOString()}|${id}` — keyset over created_at DESC */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8");
  const idx = raw.lastIndexOf("|");
  if (idx <= 0) return null;
  const createdAt = new Date(raw.slice(0, idx));
  const id = raw.slice(idx + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
    private readonly legal: LegalService,
  ) {}

  async listUsers(query: AdminUsersQuery): Promise<Paginated<AdminUserDto>> {
    const conditions: SQL[] = [];
    if (query.q) {
      const like = `%${query.q}%`;
      conditions.push(
        or(ilike(users.email, like), ilike(users.username, like), ilike(users.displayName, like))!,
      );
    }
    if (query.status) conditions.push(eq(users.accountStatus, query.status));
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) {
      conditions.push(sql`(${users.createdAt}, ${users.id}) < (${cursor.createdAt}, ${cursor.id})`);
    }

    const rows = await this.db
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const items = await Promise.all(page.map((u) => this.toAdminUserDto(u)));
    return {
      items,
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getUser(id: string, actorId: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    }
    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "admin.user_viewed",
      targetType: "user",
      targetId: id,
    });
    const consents: ConsentSummaryDto[] = (await this.legal.consentsFor(id)).map((c) => ({
      docType: c.docType,
      version: c.version,
      acceptedAt: c.acceptedAt,
    }));
    return { ...(await this.toAdminUserDto(user)), consents };
  }

  async listAudit(query: AdminAuditQuery): Promise<Paginated<AuditEventDto>> {
    const conditions: SQL[] = [];
    if (query.targetType) conditions.push(eq(auditEvents.targetType, query.targetType));
    if (query.targetId) conditions.push(eq(auditEvents.targetId, query.targetId));
    if (query.actorId) conditions.push(eq(auditEvents.actorId, query.actorId));
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) {
      conditions.push(
        sql`(${auditEvents.createdAt}, ${auditEvents.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorType: r.actorType,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        requestId: r.requestId,
        diffRedacted: r.diffRedacted,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  private async toAdminUserDto(user: InternalUser): Promise<AdminUserDto> {
    return {
      ...toUserDto(user),
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      statusReason: user.statusReason,
      statusChangedAt: user.statusChangedAt?.toISOString() ?? null,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      roles: await this.roles.rolesFor(user.id),
    };
  }
}
