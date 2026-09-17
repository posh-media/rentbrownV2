import { Global, Module } from "@nestjs/common";
import { RolesService } from "./roles.service.js";

@Global()
@Module({
  providers: [RolesService],
  exports: [RolesService],
})
export class RbacModule {}
