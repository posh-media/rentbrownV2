import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  adminKycDecisionSchema,
  adminKycNoteSchema,
  adminKycQuerySchema,
  type AdminKycDecisionInput,
  type AdminKycNoteInput,
  type AdminKycQuery,
} from "@rentbrown/validation";
import type { AdminKycCaseDto, Paginated } from "@rentbrown/types";
import { AdminOnly } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { InternalUser } from "../users/users.service.js";
import { KycService } from "./kyc.service.js";

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: "admin/kyc", version: "1" })
export class AdminKycController {
  constructor(private readonly kyc: KycService) {}

  @Get("cases")
  @AdminOnly("kyc.read")
  listCases(
    @Query(new ZodValidationPipe(adminKycQuerySchema)) query: AdminKycQuery,
  ): Promise<Paginated<AdminKycCaseDto>> {
    return this.kyc.listCases(query);
  }

  @Get("cases/:id")
  @AdminOnly("kyc.read")
  getCase(
    @CurrentUser() actor: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AdminKycCaseDto> {
    return this.kyc.getCaseAdmin(id, actor.id);
  }

  @Post("cases/:id/decision")
  @AdminOnly("kyc.review")
  decide(
    @CurrentUser() actor: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminKycDecisionSchema)) body: AdminKycDecisionInput,
  ): Promise<AdminKycCaseDto> {
    return this.kyc.decide(actor, id, body);
  }

  @Post("cases/:id/notes")
  @AdminOnly("kyc.review")
  async addNote(
    @CurrentUser() actor: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminKycNoteSchema)) body: AdminKycNoteInput,
  ): Promise<{ ok: boolean }> {
    await this.kyc.addInternalNote(actor, id, body.note);
    return { ok: true };
  }

  @Post("cases/:id/sync")
  @AdminOnly("kyc.review")
  async sync(@Param("id", ParseUUIDPipe) id: string): Promise<{ ok: boolean }> {
    await this.kyc.syncFromProvider(id);
    return { ok: true };
  }

  @Get("documents/:id/url")
  @AdminOnly("kyc.documents.view")
  documentUrl(
    @CurrentUser() actor: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.kyc.documentUrl(actor, id);
  }
}
