import { Module } from "@nestjs/common";
import type { KycProvider, StorageProvider } from "@rentbrown/providers";
import { AppConfigService } from "../../config/config.service.js";
import { LegalModule } from "../legal/legal.module.js";
import {
  KYC_PROVIDER,
  NotConfiguredStorageProvider,
  STORAGE_PROVIDER,
  SupabaseStorageProvider,
} from "../storage/storage.provider.js";
import { AdminKycController } from "./admin-kyc.controller.js";
import { KycController } from "./kyc.controller.js";
import { KycWebhookController } from "./kyc-webhook.controller.js";
import { KycPolicyService } from "./kyc-policy.service.js";
import { KycService } from "./kyc.service.js";
import { MockKycProvider } from "./providers/mock-kyc.provider.js";
import {
  NotConfiguredKycProvider,
  SmileIdentityKycProvider,
} from "./providers/smile-identity.provider.js";

/** KYC provider selection — mock is DEV-ONLY and refuses to load in prod */
export function createKycProvider(config: AppConfigService): KycProvider {
  if (config.get("KYC_PROVIDER") === "mock") {
    // never silently mock identity verification in production
    if (config.isProd) {
      throw new Error("KYC_PROVIDER=mock is forbidden when APP_ENV=production");
    }
    return new MockKycProvider();
  }
  return config.get("SMILE_IDENTITY_PARTNER_ID") && config.get("SMILE_IDENTITY_API_KEY")
    ? new SmileIdentityKycProvider(config)
    : new NotConfiguredKycProvider();
}

/**
 * KYC foundation — Smile Identity v3 for ID verification, Supabase Storage
 * (private bucket) for documents. Both adapters are selected by config:
 * missing credentials yield NOT_CONFIGURED stubs that surface a clean 503
 * rather than failing at boot.
 */
@Module({
  imports: [LegalModule],
  controllers: [KycController, KycWebhookController, AdminKycController],
  providers: [
    KycService,
    KycPolicyService,
    {
      provide: KYC_PROVIDER,
      inject: [AppConfigService],
      useFactory: createKycProvider,
    },
    {
      provide: STORAGE_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): StorageProvider =>
        config.get("SUPABASE_SERVICE_ROLE_KEY")
          ? SupabaseStorageProvider.fromConfig(config)
          : new NotConfiguredStorageProvider(),
    },
  ],
  exports: [KycService, KycPolicyService],
})
export class KycModule {}
