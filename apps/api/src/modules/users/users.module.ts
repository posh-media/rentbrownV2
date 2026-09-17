import { Global, Module } from "@nestjs/common";
import { InternalUserGuard } from "../../common/guards/internal-user.guard.js";
import { PermissionsGuard } from "../../common/guards/permissions.guard.js";
import { KycModule } from "../kyc/kyc.module.js";
import { LegalModule } from "../legal/legal.module.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

/**
 * Global — InternalUserGuard/PermissionsGuard resolve UsersService and
 * RolesService (via RbacModule) from any module without per-module imports.
 * KycModule supplies the /users/me summary + capabilities.
 */
@Global()
@Module({
  imports: [LegalModule, KycModule],
  controllers: [UsersController],
  providers: [UsersService, InternalUserGuard, PermissionsGuard],
  exports: [UsersService, InternalUserGuard, PermissionsGuard],
})
export class UsersModule {}
