import { Global, Module } from "@nestjs/common";
import { MfaGuard } from "../../common/guards/mfa.guard.js";
import { PoliciesService } from "./policies.service.js";
import { PoliciesController } from "./policies.controller.js";

/**
 * Policies are global — MfaGuard and user flows read them from any module.
 */
@Global()
@Module({
  providers: [PoliciesService, MfaGuard],
  controllers: [PoliciesController],
  exports: [PoliciesService, MfaGuard],
})
export class PoliciesModule {}
