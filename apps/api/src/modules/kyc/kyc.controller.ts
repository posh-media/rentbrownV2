import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  idVerificationSchema,
  kycDocTypeSchema,
  startKycCaseSchema,
  type IdVerificationInput,
  type StartKycCaseInput,
} from "@rentbrown/validation";
import type { KycCaseDto, KycDocumentDto, KycSummaryDto } from "@rentbrown/types";
import { memoryStorage } from "multer";
import { Authenticated } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { InternalUser } from "../users/users.service.js";
import { KycService } from "./kyc.service.js";

const HARD_UPLOAD_CAP = 10 * 1024 * 1024; // 10 MB hard cap; policy max enforced in the service

@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller({ path: "kyc", version: "1" })
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get("status")
  @Authenticated()
  status(@CurrentUser() user: InternalUser): Promise<KycSummaryDto> {
    return this.kyc.summaryFor(user.id);
  }

  @Post("cases")
  @Authenticated()
  startCase(
    @CurrentUser() user: InternalUser,
    @Body(new ZodValidationPipe(startKycCaseSchema)) body: StartKycCaseInput,
  ): Promise<KycCaseDto> {
    return this.kyc.startCase(user, body.requestedTier);
  }

  @Get("cases/:id")
  @Authenticated()
  getCase(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KycCaseDto> {
    return this.kyc.getOwnedCase(user.id, id);
  }

  @Post("cases/:id/checks/id-verification")
  @Authenticated()
  submitIdVerification(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(idVerificationSchema)) body: IdVerificationInput,
  ): Promise<KycCaseDto> {
    return this.kyc.submitIdVerification(user, id, body);
  }

  @Post("cases/:id/documents")
  @Authenticated()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: HARD_UPLOAD_CAP },
    }),
  )
  uploadDocument(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Body("docType") docType: string,
  ): Promise<KycDocumentDto> {
    const parsed = kycDocTypeSchema.safeParse(docType);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "docType must be one of ID_FRONT, ID_BACK, SELFIE, PROOF_OF_ADDRESS, OTHER",
      });
    }
    if (!file) {
      throw new BadRequestException({ code: "FILE_REQUIRED", message: "file is required" });
    }
    return this.kyc.uploadDocument(user, id, file, parsed.data);
  }

  @Delete("documents/:id")
  @Authenticated()
  async deleteDocument(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ ok: boolean }> {
    await this.kyc.deleteDocument(user, id);
    return { ok: true };
  }

  @Get("documents/:id/url")
  @Authenticated()
  documentUrl(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.kyc.documentUrl(user, id);
  }

  @Post("cases/:id/sync")
  @Authenticated()
  async sync(
    @CurrentUser() user: InternalUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ ok: boolean }> {
    await this.kyc.getOwnedCase(user.id, id); // ownership check
    await this.kyc.syncFromProvider(id);
    return { ok: true };
  }
}
