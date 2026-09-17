import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { KycService } from "./kyc.service.js";

/**
 * Smile Identity v3 webhook receiver — deliberately NO auth guards: the
 * HMAC signature over the raw body is the authentication. `rawBody: true`
 * is enabled on NestFactory.create in main.ts.
 */
@Controller({ path: "kyc/webhooks", version: "1" })
export class KycWebhookController {
  constructor(private readonly kyc: KycService) {}

  @Post("smile-identity")
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async smileIdentity(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException({
        code: "INVALID_PAYLOAD",
        message: "Raw request body is required",
      });
    }
    return this.kyc.handleProviderCallback(headers, req.rawBody);
  }
}
