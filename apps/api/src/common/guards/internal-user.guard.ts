import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "./supabase-auth.guard.js";
import { UsersService } from "../../modules/users/users.service.js";

/**
 * Maps the verified Supabase identity to an internal user row (provisioning
 * on first call) and enforces account-level access: SUSPENDED, CLOSED and
 * soft-deleted accounts are rejected outright. RESTRICTED passes — per-
 * capability restriction is enforced downstream. Modules using this guard
 * must import UsersModule so UsersService resolves.
 */
@Injectable()
export class InternalUserGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.identity) throw new UnauthorizedException();

    const user = await this.users.findOrProvision(req.identity);
    if (user.accountStatus === "SUSPENDED" || user.accountStatus === "CLOSED" || user.deletedAt) {
      throw new ForbiddenException({
        code: "ACCOUNT_DISABLED",
        message: "This account is not active",
      });
    }
    req.user = user;
    return true;
  }
}
