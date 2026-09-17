import { Module } from "@nestjs/common";
import { LegalController, UserConsentsController } from "./legal.controller.js";
import { LegalService } from "./legal.service.js";

@Module({
  controllers: [LegalController, UserConsentsController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
