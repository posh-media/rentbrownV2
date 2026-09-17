import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest } from "../guards/supabase-auth.guard.js";
import type { SupabaseIdentity } from "../supabase/jwt-verifier.js";

/** injects the verified Supabase identity from the auth guard */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupabaseIdentity => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.identity;
  },
);
