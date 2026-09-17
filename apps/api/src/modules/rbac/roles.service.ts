import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database, type RoleName } from "@rentbrown/database";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";

const { roles, permissions, rolePermissions, userRoles } = schema;

/**
 * Role assignment and permission resolution. `investor` is the baseline role
 * granted at provisioning and cannot be revoked; `super_admin` grants may only
 * be made by an actor who already holds it (prevents privilege escalation).
 */
@Injectable()
export class RolesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async listRoles() {
    const allRoles = await this.db.select().from(roles);
    const grants = await this.db
      .select({ roleId: rolePermissions.roleId, name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));
    const byRole = new Map<string, string[]>();
    for (const g of grants) {
      byRole.set(g.roleId, [...(byRole.get(g.roleId) ?? []), g.name]);
    }
    return allRoles.map((r) => ({ ...r, permissions: byRole.get(r.id) ?? [] }));
  }

  async rolesFor(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.name);
  }

  async permissionsFor(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ name: permissions.name })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));
    return new Set(rows.map((r) => r.name));
  }

  /**
   * Internal grant used by provisioning/bootstrap — no self/elevation rules.
   * Pass `tx` to run inside an existing transaction (provisioning grants).
   */
  async grantSystem(
    userId: string,
    roleName: RoleName,
    assignedBy?: string,
    tx?: Database,
  ): Promise<void> {
    const db = tx ?? this.db;
    const role = await this.roleByName(roleName, db);
    if (!role) throw new NotFoundException(`unknown role ${roleName}`);
    await db
      .insert(userRoles)
      .values({ userId, roleId: role.id, assignedBy: assignedBy ?? null })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
  }

  async assign(targetUserId: string, roleName: RoleName, actorId: string): Promise<void> {
    if (targetUserId === actorId) {
      throw new ForbiddenException({
        code: "SELF_ACTION_FORBIDDEN",
        message: "Cannot change your own roles",
      });
    }
    const role = await this.roleByName(roleName);
    if (!role) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Unknown role" });
    }
    await this.requireUser(targetUserId);
    await this.assertCanGrantPrivileged(roleName, actorId);
    await this.db
      .insert(userRoles)
      .values({ userId: targetUserId, roleId: role.id, assignedBy: actorId })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "rbac.role_assigned",
      targetType: "user",
      targetId: targetUserId,
      diffRedacted: { role: roleName },
    });
  }

  async revoke(targetUserId: string, roleName: RoleName, actorId: string): Promise<void> {
    if (targetUserId === actorId) {
      throw new ForbiddenException({
        code: "SELF_ACTION_FORBIDDEN",
        message: "Cannot change your own roles",
      });
    }
    if (roleName === "investor") {
      throw new ForbiddenException({
        code: "ROLE_IMMUTABLE",
        message: "The investor role cannot be revoked",
      });
    }
    const role = await this.roleByName(roleName);
    if (!role) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Unknown role" });
    }
    await this.requireUser(targetUserId);
    await this.assertCanGrantPrivileged(roleName, actorId);
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, targetUserId), eq(userRoles.roleId, role.id)));
    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "rbac.role_revoked",
      targetType: "user",
      targetId: targetUserId,
      diffRedacted: { role: roleName },
    });
  }

  private async assertCanGrantPrivileged(roleName: RoleName, actorId: string) {
    if (roleName !== "super_admin") return;
    const actorRoles = await this.rolesFor(actorId);
    if (!actorRoles.includes("super_admin")) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_ROLE",
        message: "Granting super_admin requires the super_admin role",
      });
    }
  }

  private async requireUser(userId: string) {
    const rows = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    }
  }

  private async roleByName(name: string, db: Database = this.db) {
    const rows = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return rows[0];
  }
}
