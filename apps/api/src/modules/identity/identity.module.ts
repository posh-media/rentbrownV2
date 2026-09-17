import { Global, Module } from "@nestjs/common";
import { SupabaseJwtVerifier } from "../../common/supabase/jwt-verifier.js";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard.js";

/**
 * Identity — Supabase Auth integration boundary. Verifier and guard are
 * global so any module can protect routes without re-wiring providers.
 */
@Global()
@Module({
  providers: [SupabaseJwtVerifier, SupabaseAuthGuard],
  exports: [SupabaseJwtVerifier, SupabaseAuthGuard],
})
export class IdentityModule {}
