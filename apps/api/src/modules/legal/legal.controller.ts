import { Body, Controller, Get, Headers, Ip, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { platformSchema, recordConsentSchema } from "@rentbrown/validation";
import { Authenticated } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { InternalUser } from "../users/users.service.js";
import { LegalService } from "./legal.service.js";

@ApiTags("legal")
@Controller({ path: "legal", version: "1" })
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  /** current published legal documents — public, no auth required */
  @Get("documents")
  documents() {
    return this.legal.currentDocuments();
  }
}

@ApiTags("users")
@ApiBearerAuth()
@Controller({ path: "users/me/consents", version: "1" })
export class UserConsentsController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  @Authenticated()
  list(@CurrentUser() user: InternalUser) {
    return this.legal.consentsFor(user.id);
  }

  @Post()
  @Authenticated()
  record(
    @CurrentUser() user: InternalUser,
    @Body(new ZodValidationPipe(recordConsentSchema)) body: { termsVersionId: string },
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
    @Headers("x-platform") platform?: string,
  ) {
    const parsedPlatform = platformSchema.safeParse(platform);
    return this.legal.recordConsent(user.id, body.termsVersionId, {
      ip,
      userAgent,
      platform: parsedPlatform.success ? parsedPlatform.data : undefined,
    });
  }
}
