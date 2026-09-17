import { Module } from "@nestjs/common";
import { LegalModule } from "../legal/legal.module.js";
import { AdminService } from "./admin.service.js";
import {
  AdminAuditController,
  AdminRolesController,
  AdminUsersController,
} from "./admin.controller.js";

@Module({
  imports: [LegalModule],
  providers: [AdminService],
  controllers: [AdminUsersController, AdminRolesController, AdminAuditController],
})
export class AdminModule {}
