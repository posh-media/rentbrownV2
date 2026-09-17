import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator.js";
import type { AuthenticatedRequest } from "./supabase-auth.guard.js";
import { UsersService } from "../../modules/users/users.service.js";

/**
 * RBAC guard — runs after SupabaseAuthGuard, checks that the internal user
 * holds every permission declared via @RequirePermissions. Modules that use
 * this guard must import UsersModule so UsersService resolves.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.identity) throw new UnauthorizedException();

    const user = await this.users.findOrProvision(req.identity);
    const granted = await this.users.permissionsFor(user.id);

    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      });
    }
    return true;
  }
}
