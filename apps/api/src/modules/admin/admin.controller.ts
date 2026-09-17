import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  adminAuditQuerySchema,
  adminSetStatusSchema,
  adminUsersQuerySchema,
  assignRoleSchema,
  type AdminAuditQuery,
  type AdminSetStatusInput,
  type AdminUsersQuery,
  type AssignRoleInput,
} from "@rentbrown/validation";
import { ROLE_NAMES, type RoleName } from "@rentbrown/database";
import { AdminOnly } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { RolesService } from "../rbac/roles.service.js";
import { UsersService, type InternalUser } from "../users/users.service.js";
import { AdminService } from "./admin.service.js";

@ApiTags("admin")
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: "admin/users", version: "1" })
export class AdminUsersController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  @AdminOnly("users.read")
  list(@Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery) {
    return this.admin.listUsers(query);
  }

  @Get(":id")
  @AdminOnly("users.read")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() actor: InternalUser) {
    return this.admin.getUser(id, actor.id);
  }

  @Post(":id/status")
  @AdminOnly("users.manage_status")
  async setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminSetStatusSchema)) body: AdminSetStatusInput,
    @CurrentUser() actor: InternalUser,
  ) {
    await this.users.setAccountStatus(id, body.status, body.reason, actor.id);
    return this.admin.getUser(id, actor.id);
  }

  @Post(":id/roles")
  @HttpCode(204)
  @AdminOnly("roles.assign")
  async assignRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignRoleSchema)) body: AssignRoleInput,
    @CurrentUser() actor: InternalUser,
  ) {
    await this.roles.assign(id, body.role as RoleName, actor.id);
  }

  @Delete(":id/roles/:role")
  @HttpCode(204)
  @AdminOnly("roles.assign")
  async revokeRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("role") role: string,
    @CurrentUser() actor: InternalUser,
  ) {
    if (!(ROLE_NAMES as readonly string[]).includes(role)) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Unknown role" });
    }
    await this.roles.revoke(id, role as RoleName, actor.id);
  }
}

@ApiTags("admin")
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: "admin/roles", version: "1" })
export class AdminRolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @AdminOnly("roles.read")
  list() {
    return this.roles.listRoles();
  }
}

@ApiTags("admin")
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: "admin/audit", version: "1" })
export class AdminAuditController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @AdminOnly("audit.read")
  list(@Query(new ZodValidationPipe(adminAuditQuerySchema)) query: AdminAuditQuery) {
    return this.admin.listAudit(query);
  }
}
