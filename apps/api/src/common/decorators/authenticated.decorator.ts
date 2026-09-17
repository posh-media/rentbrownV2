import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import type { PermissionName } from "@rentbrown/database";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard.js";
import { InternalUserGuard } from "../guards/internal-user.guard.js";
import { MfaGuard } from "../guards/mfa.guard.js";
import { PermissionsGuard } from "../guards/permissions.guard.js";
import { RequirePermissions } from "./permissions.decorator.js";

/**
 * Standard authenticated endpoint: verifies the Supabase token, provisions
 * the internal user, and rejects disabled accounts. The module must import
 * UsersModule for the guard dependencies to resolve.
 */
export const Authenticated = (): MethodDecorator =>
  applyDecorators(
    UseGuards(SupabaseAuthGuard, InternalUserGuard),
    ApiBearerAuth(),
  ) as MethodDecorator;

/**
 * Admin endpoint: authenticated + MFA/session-age policy + RBAC permission
 * check. The module must import UsersModule and RbacModule.
 */
export const AdminOnly = (...permissions: PermissionName[]): MethodDecorator =>
  applyDecorators(
    UseGuards(SupabaseAuthGuard, InternalUserGuard, MfaGuard, PermissionsGuard),
    RequirePermissions(...permissions),
    ApiBearerAuth(),
  ) as MethodDecorator;
