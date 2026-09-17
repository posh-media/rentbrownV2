import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseJwtVerifier, type SupabaseIdentity } from "../supabase/jwt-verifier.js";
import type { InternalUser } from "../../modules/users/users.service.js";

export interface AuthenticatedRequest extends Request {
  identity: SupabaseIdentity;
  /** set by InternalUserGuard after provisioning/status check */
  user?: InternalUser;
}

/** verifies the Supabase bearer token and attaches `request.identity` */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly verifier: SupabaseJwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    req.identity = await this.verifier.verify(header.slice(7));
    return true;
  }
}
